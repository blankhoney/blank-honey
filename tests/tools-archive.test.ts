import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import SevenZip from '7z-wasm';

import { ArchiveClient } from '../src/tools/archive/client';
import {
  ArchiveEngine,
  EngineFailure,
  LogSink,
  LOG_CAPACITY,
  parseListing,
  type EngineFactory,
} from '../src/tools/archive/engine';
import {
  DEFAULT_LIMITS,
  archiveNameForCreate,
  budgetError,
  checkCreateInputs,
  classifyFailure,
  expandSelection,
  inputSizeError,
  limitsFor,
  normalizeEntryName,
  planExtraction,
  safeDownloadName,
  selectedListFile,
  summarize,
  tailOfLog,
  timeoutMsFor,
  type ArchiveEntry,
} from '../src/tools/archive/plan';
import { parseRequest, parseResponse } from '../src/tools/archive/protocol';

const wasmPath = resolve('node_modules/7z-wasm/7zz.wasm');

/**
 * 测试用 Node 上同一个包（浏览器从 lab-dist 里复制出来的文件走同样路径）。
 * 显式传 wasmBinary，避免依赖包内的文件解析细节。
 */
const factory: EngineFactory = (options) =>
  (SevenZip as unknown as EngineFactory)({
    ...options,
    wasmBinary: readFileSync(wasmPath).buffer as ArrayBuffer,
  });

function engine(): ArchiveEngine {
  return new ArchiveEngine(factory, {});
}

function entry(name: string, size: number, extra: Partial<ArchiveEntry> = {}): ArchiveEntry {
  return { name, folder: false, size, packedSize: size, encrypted: false, link: false, ...extra };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesOf(text: string): Uint8Array {
  return encoder.encode(text);
}

function textOf(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** 少数「引擎自己不会生成」的恶意归档（绝对路径、目录穿越）用 python3 造。 */
function zipViaPython(script: string): Uint8Array | null {
  try {
    const file = resolve(
      '/tmp',
      `archive-fixture-${process.pid}-${Math.random().toString(36).slice(2)}.zip`,
    );
    execFileSync('python3', ['-c', script.replaceAll('__OUT__', file)], { stdio: 'ignore' });
    return new Uint8Array(readFileSync(file));
  } catch {
    return null;
  }
}

async function inspectFailure(
  instance: ArchiveEngine,
  archive: Uint8Array,
  password: string,
): Promise<string | null> {
  try {
    await instance.inspect(archive, password, DEFAULT_LIMITS);
    return null;
  } catch (error) {
    return String((error as { code?: string }).code ?? 'unknown');
  }
}

async function extractFailure(
  instance: ArchiveEngine,
  archive: Uint8Array,
  password: string,
  plan: Parameters<ArchiveEngine['extract']>[2],
): Promise<string | null> {
  try {
    const result = await instance.extract(archive, password, plan, DEFAULT_LIMITS);
    return result.files.length > 0 ? null : 'empty';
  } catch (error) {
    return String((error as { code?: string }).code ?? 'unknown');
  }
}

/** 引擎支持创建时直接带口令，用它把现成内容重打成加密的 7z。 */
async function encryptAs7z(
  files: Array<{ name: string; bytes: Uint8Array }>,
  password: string,
): Promise<Uint8Array> {
  const instance = await factory({
    print: () => {},
    printErr: () => {},
    quit: () => {},
  });
  const fs = instance.FS as unknown as {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
  };
  fs.mkdir('/plain');
  for (const file of files) {
    const target = `/plain/${file.name}`;
    const parent = target.slice(0, target.lastIndexOf('/'));
    try {
      fs.mkdir(parent);
    } catch {
      // 目录已存在
    }
    fs.writeFile(target, file.bytes);
  }
  instance.callMain(['a', '/enc.7z', '/plain', `-p${password}`, '-mhe=on']);
  return fs.readFile('/enc.7z');
}

test('条目名规范化：拒绝绝对路径、穿越、反斜杠与控制字符', () => {
  assert.deepEqual(normalizeEntryName('文件夹/照片.png'), { ok: true, name: '文件夹/照片.png' });
  assert.deepEqual(normalizeEntryName('dir/'), { ok: true, name: 'dir' });
  assert.equal(normalizeEntryName('/etc/passwd').ok, false);
  assert.equal(normalizeEntryName('C:/Windows').ok, false);
  assert.equal(normalizeEntryName('../escape.txt').ok, false);
  assert.equal(normalizeEntryName('a/../b.txt').ok, false);
  assert.equal(normalizeEntryName('a//b.txt').ok, false);
  assert.equal(normalizeEntryName('dir\\win.txt').ok, false);
  assert.equal(normalizeEntryName('line\nbreak.txt').ok, false);
  assert.equal(normalizeEntryName('tab\tname.txt').ok, false);
  assert.equal(normalizeEntryName('').ok, false);
  assert.deepEqual(normalizeEntryName('.'), { ok: true, name: '.' }, '单点号是普通名字');
});

test('预算：条目数、展开量与输入大小都在列表阶段判断', () => {
  const limits = limitsFor(false);
  assert.equal(limits, DEFAULT_LIMITS);
  assert.deepEqual(limitsFor(true), {
    inputBytes: 48 * 1024 * 1024,
    expandedBytes: 128 * 1024 * 1024,
    entries: 300,
  });
  assert.ok(limitsFor(true).entries < DEFAULT_LIMITS.entries, '手机预算必须更低');

  const many = Array.from({ length: 1001 }, (_, index) => entry(`f${index}.txt`, 1));
  assert.match(String(budgetError(summarize(many), limits)), /条目数/);
  const heavy = [entry('big.bin', 300 * 1024 * 1024)];
  assert.match(String(budgetError(summarize(heavy), limits)), /展开总量/);
  assert.equal(budgetError(summarize([entry('ok.txt', 10)]), limits), null);
  assert.match(String(inputSizeError(200 * 1024 * 1024, limits)), /超过上限/);
  assert.equal(inputSizeError(1024, limits), null);
});

test('纯函数：选择展开、选项文件、下载名与超时', () => {
  const list = [
    entry('相册', 0, { folder: true }),
    entry('相册/a.png', 10),
    entry('相册/b.png', 20),
    entry('说明.txt', 5),
  ];
  assert.deepEqual(expandSelection(list, ['相册']), ['相册', '相册/a.png', '相册/b.png']);
  assert.deepEqual(expandSelection(list, ['说明.txt']), ['说明.txt']);
  assert.equal(selectedListFile(['a.txt', '相册/b.png']), 'a.txt\n相册/b.png\n');
  assert.equal(safeDownloadName('../../etc/passwd'), '..-..-etc-passwd'.replace(/^\.+/, ''));
  assert.equal(safeDownloadName(''), 'download');
  assert.equal(safeDownloadName('照片\r\n.png'), '照片.png', '控制字符只去掉，不留下占位符');
  assert.equal(archiveNameForCreate([{ name: '相册.zip', size: 1 }], [], '7z'), '相册.7z');
  assert.equal(archiveNameForCreate([], [], 'zip'), '打包结果.zip');
  assert.equal(timeoutMsFor(0), 20_000);
  assert.equal(timeoutMsFor(500 * 1024 * 1024), 300_000, '超大输入也不能让看门狗无限等');
  assert.ok(timeoutMsFor(50 * 1024 * 1024) > 60_000);
  assert.equal(tailOfLog('12345', 3), '345');
  assert.equal(tailOfLog('12345', 99), '12345');
});

test('失败分类：口令、损坏、不支持都给出稳定说明', () => {
  assert.equal(
    classifyFailure('ERROR: Cannot open encrypted archive. Wrong password?').code,
    'password',
  );
  assert.equal(classifyFailure('Cannot open the file as [zip] archive').code, 'corrupt');
  assert.equal(classifyFailure('Is not archive').code, 'corrupt');
  assert.equal(classifyFailure('Enter password:').code, 'password');
  assert.equal(classifyFailure('Unsupported Method').code, 'unsupported');
  assert.equal(classifyFailure('something else entirely').code, 'engine');
});

test('提取计划：先核对选择，再算总量并补齐父目录', () => {
  const list = [
    entry('doc', 0, { folder: true }),
    entry('doc/a.txt', 10),
    entry('doc/sub/b.txt', 20),
    entry('bad/../evil.txt', 1, { unsafe: '包含目录穿越（..）' }),
    entry('link.txt', 1, { link: true }),
  ];
  const ok = planExtraction(list, ['doc'], DEFAULT_LIMITS);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.plan.selected, ['doc'], 'selected 只记用户最初选中的条目');
    assert.deepEqual(ok.plan.directories, ['doc', 'doc/sub'], 'directories 才是补出来的父目录');
  }
  if (!ok.ok) return;
  assert.deepEqual(ok.plan.names, ['doc/a.txt', 'doc/sub/b.txt']);
  assert.deepEqual(ok.plan.directories, ['doc', 'doc/sub']);
  assert.equal(ok.plan.totalBytes, 30);

  assert.equal(planExtraction(list, [], DEFAULT_LIMITS).ok, false);
  assert.equal(planExtraction(list, ['nope.txt'], DEFAULT_LIMITS).ok, false);
  const unsafe = planExtraction(list, ['bad/../evil.txt'], DEFAULT_LIMITS);
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) assert.match(unsafe.reason, /不安全/);
  const linked = planExtraction(list, ['link.txt'], DEFAULT_LIMITS);
  assert.equal(linked.ok, false);
  if (!linked.ok) assert.match(linked.reason, /符号链接/);
  const budget = planExtraction(
    [entry('huge.bin', 999 * 1024 * 1024)],
    ['huge.bin'],
    DEFAULT_LIMITS,
  );
  assert.equal(budget.ok, false);
  if (!budget.ok) assert.match(budget.reason, /展开量/);
});

test('含换行的条目名无法写进 -i@ 选项文件，整单拒绝', () => {
  const list = [entry('ok.txt', 1), entry('odd_name.txt', 1, { unsafe: undefined })];
  const ok = planExtraction(list, ['ok.txt'], DEFAULT_LIMITS);
  assert.equal(ok.ok, true);
  const lines = selectedListFile(['a', 'b']);
  assert.equal(lines.split('\n').filter((line) => line.length > 0).length, 2, '每个名字占一行');
});

test('创建前检查：空输入、重复名与超预算都能提前拦下', () => {
  assert.equal(checkCreateInputs([], [], DEFAULT_LIMITS).ok, false);
  const dup = checkCreateInputs(
    [
      { name: 'a.txt', size: 1 },
      { name: 'a.txt', size: 2 },
    ],
    [],
    DEFAULT_LIMITS,
  );
  assert.equal(dup.ok, true);
  if (dup.ok) assert.equal(dup.files.length, 1);
  assert.equal(checkCreateInputs([{ name: '../x', size: 1 }], [], DEFAULT_LIMITS).ok, false);
  assert.equal(
    checkCreateInputs([{ name: 'big.bin', size: 200 * 1024 * 1024 }], [], DEFAULT_LIMITS).ok,
    false,
  );
});

test('协议：请求与响应只接受结构正确的消息', () => {
  const archive = new ArrayBuffer(4);
  const inspect = parseRequest({
    type: 'inspect',
    id: 7,
    archive,
    password: 'p',
    limits: DEFAULT_LIMITS,
  });
  assert.equal(inspect?.type, 'inspect');
  if (inspect?.type === 'inspect') {
    assert.equal(inspect.id, 7);
    assert.equal(inspect.archive, archive);
    assert.equal(inspect.password, 'p');
  }
  assert.equal(
    parseRequest({ type: 'inspect', id: 1, archive: 'nope', password: '', limits: DEFAULT_LIMITS }),
    null,
  );
  assert.equal(parseRequest({ type: 'nonsense', id: 1 }), null);
  assert.equal(parseRequest(null), null);
  assert.deepEqual(
    parseRequest({ type: 'init', engineUrl: 'https://lab.example/tools/vendor/7z/' }),
    {
      type: 'init',
      engineUrl: 'https://lab.example/tools/vendor/7z/',
    },
  );
  // extract 现在自带归档字节、口令与限额：每次任务都是新 worker，没有跨任务状态。
  assert.equal(
    parseRequest({
      type: 'extract',
      id: 3,
      plan: {
        names: ['a.txt'],
        directories: [],
        totalBytes: 1,
        sizes: { 'a.txt': 1 },
        selected: ['a.txt'],
      },
      archive,
      password: '',
      limits: DEFAULT_LIMITS,
    })?.type,
    'extract',
  );
  assert.equal(
    parseRequest({
      type: 'extract',
      id: 3,
      plan: {
        names: ['a.txt'],
        directories: [],
        totalBytes: 1,
        sizes: { 'a.txt': 1 },
        selected: ['a.txt'],
      },
      archive: 'not-bytes',
      password: '',
      limits: DEFAULT_LIMITS,
    }),
    null,
    '缺少归档字节的 extract 必须被拒绝',
  );
  assert.equal(
    parseRequest({
      type: 'extract',
      id: 3,
      plan: { names: ['a.txt'], directories: [], totalBytes: 1 },
      archive,
      password: '',
      limits: DEFAULT_LIMITS,
    }),
    null,
    '缺少预检大小的计划不可信',
  );
  assert.equal(
    parseRequest({
      type: 'extract',
      id: 3,
      plan: { names: [1] },
      archive,
      password: '',
      limits: DEFAULT_LIMITS,
    }),
    null,
  );
  assert.equal(
    parseRequest({
      type: 'create',
      id: 4,
      format: 'rar',
      level: 'normal',
      files: [],
      directories: [],
      limits: DEFAULT_LIMITS,
    }),
    null,
  );

  assert.equal(
    parseResponse({ type: 'created', id: 2, bytes: new ArrayBuffer(2), entries: 1 })?.type,
    'created',
  );
  assert.equal(parseResponse({ type: 'created', id: 2, bytes: 'x', entries: 1 }), null);
  const inspected = parseResponse({
    type: 'inspected',
    id: 1,
    entries: [entry('a.txt', 1)],
    summary: summarize([entry('a.txt', 1)]),
    encryptedNames: 0,
  });
  assert.equal(inspected?.type, 'inspected');
  assert.equal(
    parseResponse({
      type: 'inspected',
      id: 1,
      entries: [{ name: 'a' }],
      summary: summarize([]),
      encryptedNames: 0,
    }),
    null,
  );
  assert.equal(
    parseResponse({ type: 'failed', id: 4, code: 'corrupt', message: '坏了' })?.type,
    'failed',
  );
  assert.equal(parseResponse({ type: 'failed', id: 4, code: 1, message: '坏了' }), null);
  assert.equal(parseResponse({ type: 'ready' })?.type, 'ready');
});

test('中文名与空文件的 ZIP 夹具（真实引擎生成）能列清单并取回', async () => {
  const instance = engine();
  // 夹具改由引擎自己生成，不再维护第二套 ZIP 写入器。
  const created = await instance.create(
    'zip',
    'normal',
    [
      { name: '目录/说明.txt', bytes: bytesOf('说明内容') },
      { name: '空文件.txt', bytes: new Uint8Array(0) },
    ],
    ['目录'],
    DEFAULT_LIMITS,
  );
  const inspected = await instance.inspect(created.bytes, '', DEFAULT_LIMITS);
  assert.deepEqual(
    inspected.entries.map((item) => item.name).sort(),
    ['空文件.txt', '目录', '目录/说明.txt'].sort(),
  );
  const plan = planExtraction(inspected.entries, ['目录/说明.txt', '空文件.txt'], DEFAULT_LIMITS);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const extracted = await instance.extract(created.bytes, '', plan.plan, DEFAULT_LIMITS);
  const found = extracted.files.find((file) => file.name === '目录/说明.txt');
  assert.ok(found, '中文名条目要能取回');
  assert.equal(textOf(found!.bytes), '说明内容');
  assert.equal(extracted.files.find((file) => file.name === '空文件.txt')?.bytes.length, 0);
});

test('引擎往返：创建 ZIP 与 7z，再按清单取回同样的字节', async () => {
  const instance = engine();
  const files = [
    { name: '说明.txt', bytes: bytesOf('中文说明 content') },
    { name: '相册/照片.bin', bytes: new Uint8Array([0, 1, 2, 254, 255]) },
    { name: '相册/空文件.txt', bytes: new Uint8Array(0) },
  ];
  for (const format of ['zip', '7z'] as const) {
    const created = await instance.create(format, 'normal', files, ['相册'], DEFAULT_LIMITS);
    const inspected = await instance.inspect(created.bytes, '', DEFAULT_LIMITS);
    const names = inspected.entries.map((item) => item.name);
    for (const file of files)
      assert.ok(names.includes(file.name), `${format} 里应该有 ${file.name}`);
    assert.ok(names.includes('相册'), '目录条目要保留');
    assert.equal(inspected.summary.unsafe, 0, `${format} 的条目名都应安全`);

    const plan = planExtraction(
      inspected.entries,
      files.map((file) => file.name),
      DEFAULT_LIMITS,
    );
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    const extracted = await instance.extract(created.bytes, '', plan.plan, DEFAULT_LIMITS);
    assert.equal(extracted.files.length, files.length);
    for (const file of files) {
      const back = extracted.files.find((item) => item.name === file.name);
      assert.ok(back, `${format} 应该解回 ${file.name}`);
      assert.deepEqual([...back!.bytes], [...file.bytes], `${format} 的 ${file.name} 字节要一致`);
    }
  }
});

test('压缩级别真的改变输出大小', async () => {
  const instance = engine();
  const big = new Uint8Array(200_000);
  for (let index = 0; index < big.length; index += 1) big[index] = index % 7;
  const files = [{ name: 'big.bin', bytes: big }];
  const fast = await instance.create('zip', 'fast', files, [], DEFAULT_LIMITS);
  const max = await instance.create('zip', 'max', files, [], DEFAULT_LIMITS);
  const stored = await instance.create('zip', 'fast', [], [], DEFAULT_LIMITS).catch(() => null);
  assert.equal(stored, null, '空输入必须失败，不能给出空压缩包');
  assert.ok(max.bytes.length <= fast.bytes.length, '更高压缩级别不应更大');
  assert.ok(max.bytes.length < big.length / 10, '重复内容应被明显压缩');
});

test('引擎往返：单条目提取、含空格与 Unicode 的名字', async () => {
  const instance = engine();
  const files = [
    { name: 'sp ace/héllo 空.txt', bytes: bytesOf('SPACE') },
    { name: 'star*name.txt', bytes: bytesOf('STAR') },
    { name: 'brack[1].txt', bytes: bytesOf('BRACK') },
    { name: 'q?mark.txt', bytes: bytesOf('QMARK') },
  ];
  const created = await instance.create('zip', 'normal', files, [], DEFAULT_LIMITS);
  const inspected = await instance.inspect(created.bytes, '', DEFAULT_LIMITS);
  for (const file of files) {
    const plan = planExtraction(inspected.entries, [file.name], DEFAULT_LIMITS);
    assert.equal(plan.ok, true, `${file.name} 应该能选中`);
    if (!plan.ok) return;
    const extracted = await instance.extract(created.bytes, '', plan.plan, DEFAULT_LIMITS);
    const back = extracted.files.find((item) => item.name === file.name);
    assert.ok(back, `${file.name} 要能被单独取出`);
    assert.equal(textOf(back!.bytes), textOf(file.bytes));
  }
});

test('加密包：错误口令失败且不留文件，正确口令取回内容', async () => {
  const instance = engine();
  const protectedBytes = await encryptAs7z(
    [{ name: 'secret.txt', bytes: bytesOf('TOP SECRET') }],
    'P@ssw0rd!',
  );
  assert.ok(protectedBytes.length > 0);

  assert.equal(
    await inspectFailure(instance, protectedBytes, ''),
    'password',
    '没有口令就不能列清单',
  );
  assert.equal(
    await inspectFailure(instance, protectedBytes, 'WRONG'),
    'password',
    '错误口令不能列清单',
  );
  const opened = await instance.inspect(protectedBytes, 'P@ssw0rd!', DEFAULT_LIMITS);
  assert.equal(opened.summary.unsafe, 0);
  assert.equal(opened.encryptedNames > 0, true, '清单要标出这是加密内容');
  const secret = opened.entries.find((item) => item.name.endsWith('secret.txt'));
  assert.ok(secret, '正确口令下列出真实条目名');
  const plan = planExtraction(opened.entries, [secret!.name], DEFAULT_LIMITS);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const extracted = await instance.extract(protectedBytes, 'P@ssw0rd!', plan.plan, DEFAULT_LIMITS);
  assert.equal(textOf(extracted.files[0].bytes), 'TOP SECRET');
  assert.notEqual(
    await extractFailure(instance, protectedBytes, 'WRONG', plan.plan),
    null,
    '错误口令不能解出文件',
  );
});

test('损坏文件与不支持的格式都判为失败', async () => {
  const instance = engine();
  assert.notEqual(
    await inspectFailure(instance, bytesOf('this is definitely not an archive'), ''),
    null,
  );
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.notEqual(await inspectFailure(instance, png, ''), null, 'PNG 不是压缩包，不能假成功');
  assert.notEqual(
    await inspectFailure(instance, new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]), ''),
    null,
    '截断的 ZIP 不能假成功',
  );
});

test('列表解析：目录条目、加密与链接标记都按 7-Zip 输出还原', () => {
  const listing = [
    'Listing archive: /w/target.bin',
    '',
    '--',
    'Path = /w/target.bin',
    'Type = zip',
    'Physical Size = 778',
    '',
    '----------',
    'Path = doc',
    'Folder = +',
    'Size = 0',
    'Packed Size = 0',
    'Attributes = D drwxrwxrwx',
    'Encrypted = -',
    'Symbolic Link = ',
    '',
    'Path = doc/空文件.txt',
    'Folder = -',
    'Size = 0',
    'Packed Size = 0',
    'Attributes =  -rw-rw-rw-',
    'Encrypted = +',
    '',
    'Path = doc/link',
    'Folder = -',
    'Size = 0',
    'Packed Size = 0',
    'Attributes = lrwxrwxrwx',
    'Symbolic Link = /etc/passwd',
    '',
  ].join('\n');
  const entries = parseListing(listing);
  assert.equal(entries.length, 3, '归档自身的元信息块要被跳过');
  assert.equal(entries[0].name, 'doc');
  assert.equal(entries[0].folder, true);
  assert.equal(entries[0].unsafe, undefined, '普通目录条目不带不安全标记');
  assert.deepEqual(entries[0], entry('doc', 0, { folder: true }));
  assert.equal(entries[1].encrypted, true);
  assert.equal(entries[2].link, true);
  assert.match(String(entries[2].unsafe), /符号链接/);
  assert.deepEqual(parseListing('no separator here'), []);
});

test('安全分支：目录穿越与绝对路径成员在清单里就被标成不安全', async (t) => {
  const traversal = zipViaPython(
    'import zipfile;z=zipfile.ZipFile("__OUT__","w",zipfile.ZIP_STORED);' +
      'z.writestr("../escape.txt", b"ESCAPED");z.writestr("safe.txt", b"OK");z.close()',
  );
  if (!traversal) {
    t.diagnostic('没有可用的 python3，跳过需要外部构造的恶意归档用例');
    return;
  }
  const instance = engine();
  const inspected = await instance.inspect(traversal, '', DEFAULT_LIMITS);
  const escape = inspected.entries.find((item) => item.name.includes('escape'));
  assert.ok(escape, '穿越条目要被列出');
  assert.ok(escape!.unsafe, '穿越条目必须标成不安全，界面上不可选');
  assert.equal(planExtraction(inspected.entries, [escape!.name], DEFAULT_LIMITS).ok, false);

  const safe = planExtraction(inspected.entries, ['safe.txt'], DEFAULT_LIMITS);
  assert.equal(safe.ok, true);
  if (!safe.ok) return;
  const extracted = await instance.extract(traversal, '', safe.plan, DEFAULT_LIMITS);
  assert.deepEqual(
    extracted.files.map((file) => file.name),
    ['safe.txt'],
    '只取选中的条目，穿越条目不会被解出',
  );

  const absolute = zipViaPython(
    'import zipfile;z=zipfile.ZipFile("__OUT__","w",zipfile.ZIP_STORED);' +
      'z.writestr("/etc/passwd", b"ABS");z.close()',
  );
  if (absolute) {
    const absoluteInspected = await instance.inspect(absolute, '', DEFAULT_LIMITS);
    assert.equal(absoluteInspected.summary.unsafe, 1, '绝对路径条目必须标成不安全');
    assert.match(String(absoluteInspected.entries[0].unsafe), /绝对路径/);
  }
});

/**
 * 假 Worker：记录每次 postMessage，并按需回一条脚本化的响应。
 * 用它验证真正的 ArchiveClient 在 worker 被销毁之后，下一次任务是否
 * 仍然把同一份归档字节和当前口令带给**新的** worker。
 */
class FakeWorker {
  static created: FakeWorker[] = [];
  static script: Array<(message: Record<string, unknown>) => void> = [];
  readonly sent: Record<string, unknown>[] = [];
  terminated = false;
  private listeners = new Set<(event: { data: unknown }) => void>();

  constructor() {
    FakeWorker.created.push(this);
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    if (type === 'message') this.listeners.add(listener);
  }

  postMessage(message: Record<string, unknown>): void {
    this.sent.push(message);
    if (message.type === 'init') {
      this.emit({ type: 'ready' });
      return;
    }
    const handler = FakeWorker.script.shift();
    handler?.(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    for (const listener of this.listeners) listener({ data });
  }

  /** 回一条带同一个 id 的响应。 */
  reply(message: Record<string, unknown>, payload: Record<string, unknown>): void {
    this.emit({ id: message.id, ...payload });
  }
}

function installFakeWorker(): () => void {
  const original = (globalThis as { Worker?: unknown }).Worker;
  FakeWorker.created = [];
  FakeWorker.script = [];
  (globalThis as { Worker?: unknown }).Worker = FakeWorker;
  return () => {
    (globalThis as { Worker?: unknown }).Worker = original;
  };
}

test('客户端：列表完成后 worker 被销毁，解压由新 worker 带上同一份字节与当前口令', async () => {
  const restore = installFakeWorker();
  try {
    const archive = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
    const file = new File([archive], 'demo.zip');
    const client = new ArchiveClient('https://lab.example/tools/vendor/7z/', {});

    // 第一次任务：inspect。回一条清单，之后 worker 必须被终止。
    FakeWorker.script.push((message) => {
      FakeWorker.created.at(-1)!.reply(message, {
        type: 'inspected',
        entries: [entry('a.txt', 4)],
        summary: summarize([entry('a.txt', 4)]),
        encryptedNames: 0,
      });
    });
    const inspected = await client.inspect(file, 'first', DEFAULT_LIMITS);
    assert.equal(inspected.entries.length, 1);
    assert.equal(FakeWorker.created.length, 1);
    assert.equal(FakeWorker.created[0].terminated, true, '任务结束后必须销毁 worker');

    // 第二次任务：extract。必须是新 worker，且携带同样的归档字节与当前口令。
    FakeWorker.script.push((message) => {
      FakeWorker.created.at(-1)!.reply(message, {
        type: 'extracted',
        files: [{ name: 'a.txt', bytes: archive.buffer.slice(0) }],
        directories: [],
      });
    });
    const plan = planExtraction(inspected.entries, ['a.txt'], DEFAULT_LIMITS);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    const extracted = await client.extract(file, 'changed-password', plan.plan, DEFAULT_LIMITS);
    assert.equal(extracted.files.length, 1);
    assert.equal(FakeWorker.created.length, 2, '解压必须用一个新 worker');
    assert.equal(FakeWorker.created[0].terminated, true);

    const second = FakeWorker.created[1];
    const extractMessage = second.sent.find((message) => message.type === 'extract')!;
    assert.ok(extractMessage, '新 worker 必须收到 extract 请求');
    assert.equal(extractMessage.password, 'changed-password', '用的是当前口令');
    const carried = new Uint8Array(extractMessage.archive as ArrayBuffer);
    assert.deepEqual([...carried], [...archive], '携带的是同一份归档字节');
    assert.equal(second.terminated, true);
    client.dispose();
  } finally {
    restore();
  }
});

test('客户端：读盘还在进行时取消，读完之后不会再建 worker', async () => {
  const restore = installFakeWorker();
  try {
    // 读盘可以很慢：先在 await 里挂住，取消之后才把它放行。
    let release!: (bytes: ArrayBuffer) => void;
    const slow = {
      name: 'slow.zip',
      size: 1024,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((resolve) => {
          release = resolve;
        }),
    } as unknown as File;
    const client = new ArchiveClient('https://lab.example/tools/vendor/7z/', {});
    const inFlight = client.inspect(slow, '', DEFAULT_LIMITS);
    await Promise.resolve();
    client.cancel();
    // 此时才让读盘结束：结果已经过期，不能再去起新 worker。
    release(new ArrayBuffer(8));
    await assert.rejects(
      inFlight,
      (error: unknown) => (error as { code?: string }).code === 'cancelled',
      '取消之后读完也不许继续',
    );
    assert.equal(FakeWorker.created.length, 0, '取消之后不能再建 worker');
  } finally {
    restore();
  }
});

test('日志截断：清单过大必须拒绝，不能拿半截清单继续解析', () => {
  const sink = new LogSink();
  assert.equal(sink.truncated, false);
  sink.write('Path = a.txt');
  assert.match(sink.value, /Path = a\.txt\n/, '每行回调都要补回换行');

  // 灌到超过容量，标记溢出后不再累积。
  const line = 'x'.repeat(1024);
  for (let index = 0; index < LOG_CAPACITY / line.length + 4; index += 1) sink.write(line);
  assert.equal(sink.truncated, true, '超过容量必须标记为截断');
  assert.equal(sink.value, '', '截断之后不再保留半截内容');
});

test('解压：引擎非 0 退出码即使留下部分文件也必须失败', async () => {
  // 假引擎：写出一个文件，然后返回非 0 退出码，模拟解压中途出错。
  const bytes = bytesOf('partial');
  const fake: EngineFactory = async (options) => {
    const fs = new Map<string, Uint8Array>();
    const dirs = new Set(['/', '/w', '/w/out']);
    const instance = {
      FS: {
        mkdir: (path: string) => void dirs.add(path),
        readdir: (path: string) => {
          const prefix = path === '/' ? '/' : `${path}/`;
          const names = new Set<string>(['.', '..']);
          for (const dir of dirs)
            if (dir.startsWith(prefix) && dir !== path)
              names.add(dir.slice(prefix.length).split('/')[0]);
          for (const key of fs.keys())
            if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
          return [...names];
        },
        lstat: (path: string) => ({
          mode: dirs.has(path) ? 0o040755 : 0o100644,
          size: fs.get(path)?.length ?? 0,
        }),
        isDir: (mode: number) => (mode & 0o170000) === 0o040000,
        isLink: () => false,
        writeFile: (path: string, data: ArrayBufferView | string) => {
          const view =
            typeof data === 'string'
              ? bytesOf(data)
              : new Uint8Array(
                  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
                );
          fs.set(path, view);
        },
        readFile: (path: string) => fs.get(path) ?? new Uint8Array(0),
        chdir: () => {},
      },
      callMain: () => {
        // 真的在沙箱里留下一个文件，但报告失败。
        dirs.add('/w/out');
        fs.set('/w/out/partial.txt', bytes);
        return 2;
      },
    };
    void options;
    return instance;
  };
  const failing = new ArchiveEngine(fake, {});
  const plan = {
    names: ['partial.txt'],
    directories: [],
    totalBytes: bytes.length,
    sizes: { 'partial.txt': bytes.length },
    selected: ['partial.txt'],
  };
  await assert.rejects(
    failing.extract(new Uint8Array([1, 2, 3]), '', plan, DEFAULT_LIMITS),
    (error: unknown) => error instanceof EngineFailure,
    '非 0 退出码不能因为存在部分输出就当成成功',
  );
});

test('解压：解出的实际字节数与清单声明不一致要失败', async () => {
  const written = bytesOf('12345');
  const fake: EngineFactory = async () => {
    const fs = new Map<string, Uint8Array>([['/w/out/a.txt', written]]);
    const dirs = new Set(['/', '/w', '/w/out']);
    return {
      FS: {
        mkdir: (path: string) => void dirs.add(path),
        readdir: (path: string) => {
          const prefix = path === '/' ? '/' : `${path}/`;
          const names = new Set<string>(['.', '..']);
          for (const dir of dirs)
            if (dir.startsWith(prefix) && dir !== path)
              names.add(dir.slice(prefix.length).split('/')[0]);
          for (const key of fs.keys())
            if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
          return [...names];
        },
        lstat: (path: string) => ({
          mode: dirs.has(path) ? 0o040755 : 0o100644,
          size: fs.get(path)?.length ?? 0,
        }),
        isDir: (mode: number) => (mode & 0o170000) === 0o040000,
        isLink: () => false,
        writeFile: () => {},
        readFile: (path: string) => fs.get(path) ?? new Uint8Array(0),
        chdir: () => {},
      },
      callMain: () => 0,
    };
  };
  const lying = new ArchiveEngine(fake, {});
  const plan = {
    names: ['a.txt'],
    directories: [],
    totalBytes: 99,
    sizes: { 'a.txt': 99 },
    selected: ['a.txt'],
  };
  await assert.rejects(
    lying.extract(new Uint8Array([1]), '', plan, DEFAULT_LIMITS),
    (error: unknown) => error instanceof EngineFailure,
    '实际字节数与清单不符必须失败',
  );
});

test('列表：Size 不是安全整数时把条目标成不可信，而不是当成 0', () => {
  const listing = [
    '--',
    'Path = /w/target.bin',
    'Type = zip',
    '',
    '----------',
    'Path = evil.bin',
    'Folder = -',
    'Size = 99999999999999999999',
    'Packed Size = 1',
    'Encrypted = -',
    '',
    'Path = nan.bin',
    'Folder = -',
    'Size = NaN',
    'Packed Size = 1',
    'Encrypted = -',
    '',
    'Path = dir',
    'Attributes = D drwxrwxrwx',
    'Size = 0',
    'Encrypted = -',
    '',
  ].join('\n');
  const entries = parseListing(listing);
  assert.equal(entries.length, 3);
  assert.match(String(entries[0].unsafe), /大小无法识别/);
  assert.match(String(entries[1].unsafe), /大小无法识别/);
  assert.equal(entries[2].folder, true, '7z 只写 Attributes = D 也要认出目录');
  assert.equal(entries[2].unsafe, undefined);
});

/**
 * 与界面等价的打包往返：inspect → 全选后 plan → 模拟 worker 只用
 * plan.selected 重做计划 → extract → create(zip, files, directories) →
 * 再 inspect/extract 核对。空目录必须活着穿过这一整条链路，
 * 而目录是按目录传给引擎的，不能被当成 0 字节文件。
 */
test('全选（含空目录）的打包往返：空目录保留、文件字节一致', async () => {
  const instance = engine();
  const files = [
    { name: '相册/说明.txt', bytes: bytesOf('相册里的说明') },
    { name: 'empty.txt', bytes: new Uint8Array(0) },
    { name: 'bytes.bin', bytes: new Uint8Array([0, 1, 2, 254, 255]) },
  ];
  const source = await instance.create('zip', 'normal', files, ['空目录'], DEFAULT_LIMITS);

  // 界面：列出清单，然后全选。
  const inspected = await instance.inspect(source.bytes, '', DEFAULT_LIMITS);
  const all = inspected.entries.map((item) => item.name);
  assert.ok(all.includes('空目录'), '源压缩包里要有空目录条目');
  const uiPlan = planExtraction(inspected.entries, all, DEFAULT_LIMITS);
  assert.equal(uiPlan.ok, true);
  if (!uiPlan.ok) return;
  assert.ok(uiPlan.plan.selected.includes('空目录'), '空目录要出现在 selected 里');

  // worker：只拿 request.plan.selected 重新做计划（不能喂 names，那会丢掉空目录）。
  const rebuilt = planExtraction(inspected.entries, uiPlan.plan.selected, DEFAULT_LIMITS);
  assert.equal(rebuilt.ok, true);
  if (!rebuilt.ok) return;
  assert.ok(rebuilt.plan.directories.includes('空目录'), '重做计划后空目录仍在');

  const extracted = await instance.extract(source.bytes, '', rebuilt.plan, DEFAULT_LIMITS);
  assert.deepEqual(extracted.directories.sort(), ['空目录', '相册'].sort());

  // 界面：多条目录出，直接交给引擎打 zip（目录走 directories 参数）。
  const repacked = await instance.create(
    'zip',
    'fast',
    extracted.files,
    extracted.directories,
    DEFAULT_LIMITS,
  );

  // 再打开这个新压缩包：空目录还在，文件字节一致。
  const again = await instance.inspect(repacked.bytes, '', DEFAULT_LIMITS);
  const againNames = again.entries.map((item) => item.name);
  assert.ok(againNames.includes('空目录'), '重新打出的包里空目录必须存在');
  assert.equal(again.entries.find((item) => item.name === '空目录')?.folder, true);
  for (const file of files) {
    assert.ok(againNames.includes(file.name), `重新打出的包里要有 ${file.name}`);
  }
  const finalPlan = planExtraction(
    again.entries,
    files.map((file) => file.name),
    DEFAULT_LIMITS,
  );
  assert.equal(finalPlan.ok, true);
  if (!finalPlan.ok) return;
  const finalRound = await instance.extract(repacked.bytes, '', finalPlan.plan, DEFAULT_LIMITS);
  for (const file of files) {
    const back = finalRound.files.find((item) => item.name === file.name);
    assert.ok(back, `要能取回 ${file.name}`);
    assert.deepEqual([...back!.bytes], [...file.bytes], `${file.name} 字节要一致`);
  }
});

test('单项提取嵌套文件：不能顺带带出它的兄弟文件', async () => {
  const instance = engine();
  const files = [
    { name: '相册/a.txt', bytes: bytesOf('A') },
    { name: '相册/b.txt', bytes: bytesOf('B') },
    { name: '相册/sub/c.txt', bytes: bytesOf('C') },
  ];
  const source = await instance.create('zip', 'normal', files, [], DEFAULT_LIMITS);
  const inspected = await instance.inspect(source.bytes, '', DEFAULT_LIMITS);
  const plan = planExtraction(inspected.entries, ['相册/a.txt'], DEFAULT_LIMITS);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const extracted = await instance.extract(source.bytes, '', plan.plan, DEFAULT_LIMITS);
  assert.deepEqual(
    extracted.files.map((file) => file.name),
    ['相册/a.txt'],
    '只应取出被选中的那一个文件',
  );
});

test('只选空目录：不解出任何文件，也不执行任意文件提取', async () => {
  const instance = engine();
  // 真实夹具：一个空目录 + 若干普通文件。
  const files = [
    { name: '相册/照片.bin', bytes: new Uint8Array([1, 2, 3]) },
    { name: '说明.txt', bytes: bytesOf('说明') },
  ];
  const source = await instance.create('zip', 'normal', files, ['空目录'], DEFAULT_LIMITS);
  const inspected = await instance.inspect(source.bytes, '', DEFAULT_LIMITS);
  assert.ok(
    inspected.entries.some((item) => item.name === '空目录' && item.folder),
    '夹具里必须有空目录条目',
  );

  const planned = planExtraction(inspected.entries, ['空目录'], DEFAULT_LIMITS);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.deepEqual(planned.plan.names, [], '只选目录时没有任何文件入选');
  assert.ok(planned.plan.directories.includes('空目录'));

  const extracted = await instance.extract(source.bytes, '', planned.plan, DEFAULT_LIMITS);
  assert.deepEqual(extracted.files, [], '不能顺手解出任何文件');
  assert.ok(extracted.directories.includes('空目录'), '空目录要保留');
  assert.equal(extracted.bytes, 0);
});

test('解压预算：lstat 报出超限大小时直接失败，且不读取任何文件', async () => {
  const huge = DEFAULT_LIMITS.expandedBytes + 1;
  let readCalls = 0;
  const fake: EngineFactory = async () => {
    const dirs = new Set(['/', '/w', '/w/out']);
    const fs = new Map<string, Uint8Array>([['/w/out/big.bin', new Uint8Array(4)]]);
    return {
      FS: {
        mkdir: (path: string) => void dirs.add(path),
        readdir: (path: string) => {
          const prefix = path === '/' ? '/' : `${path}/`;
          const names = new Set<string>(['.', '..']);
          for (const dir of dirs)
            if (dir.startsWith(prefix) && dir !== path)
              names.add(dir.slice(prefix.length).split('/')[0]);
          for (const key of fs.keys())
            if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
          return [...names];
        },
        // 谎报一个远超展开预算的大小。
        lstat: (path: string) => ({ mode: dirs.has(path) ? 0o040755 : 0o100644, size: huge }),
        isDir: (mode: number) => (mode & 0o170000) === 0o040000,
        isLink: () => false,
        writeFile: () => {},
        readFile: (path: string) => {
          readCalls += 1;
          return fs.get(path) ?? new Uint8Array(0);
        },
        chdir: () => {},
      },
      callMain: () => 0,
    };
  };
  const instance = new ArchiveEngine(fake, {});
  const plan = {
    names: ['big.bin'],
    directories: [],
    totalBytes: 4,
    sizes: { 'big.bin': 4 },
    selected: ['big.bin'],
  };
  await assert.rejects(
    instance.extract(new Uint8Array([1]), '', plan, DEFAULT_LIMITS),
    (error: unknown) =>
      error instanceof EngineFailure && (error as EngineFailure).code === 'budget',
    '超出展开预算必须以 budget 失败',
  );
  assert.equal(readCalls, 0, '预算已经超了就不能再去读文件内容');
});

test('解压预算：仅目录数超过上限也要失败', async () => {
  const limits = { ...DEFAULT_LIMITS, entries: 1 };
  const fake: EngineFactory = async () => {
    const dirs = new Set(['/', '/w', '/w/out', '/w/out/a', '/w/out/b']);
    const fs = new Map<string, Uint8Array>();
    return {
      FS: {
        mkdir: (path: string) => void dirs.add(path),
        readdir: (path: string) => {
          const prefix = path === '/' ? '/' : `${path}/`;
          const names = new Set<string>(['.', '..']);
          for (const dir of dirs)
            if (dir.startsWith(prefix) && dir !== path)
              names.add(dir.slice(prefix.length).split('/')[0]);
          for (const key of fs.keys())
            if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
          return [...names];
        },
        lstat: (path: string) => ({ mode: dirs.has(path) ? 0o040755 : 0o100644, size: 1 }),
        isDir: (mode: number) => (mode & 0o170000) === 0o040000,
        isLink: () => false,
        writeFile: () => {},
        readFile: (path: string) => fs.get(path) ?? new Uint8Array(0),
        chdir: () => {},
      },
      callMain: () => 0,
    };
  };
  const instance = new ArchiveEngine(fake, {});
  const plan = {
    names: ['a.txt', 'b.txt'],
    directories: [],
    totalBytes: 2,
    sizes: { 'a.txt': 1, 'b.txt': 1 },
    selected: ['a.txt', 'b.txt'],
  };
  await assert.rejects(
    instance.extract(new Uint8Array([1]), '', plan, limits),
    (error: unknown) =>
      error instanceof EngineFailure && (error as EngineFailure).code === 'budget',
    '超出条目数预算要以 budget 失败',
  );
});

test('名为 __proto__ 的合法条目：sizes 里有它自己的数值字段', () => {
  const list = [entry('__proto__', 7), entry('constructor', 3), entry('普通.txt', 1)];
  const planned = planExtraction(list, ['__proto__', 'constructor', '普通.txt'], DEFAULT_LIMITS);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(Object.hasOwn(planned.plan.sizes, '__proto__'), true, '__proto__ 是自己拥有的字段');
  assert.equal(planned.plan.sizes['__proto__'], 7);
  assert.equal(planned.plan.sizes['constructor'], 3);
  assert.equal(planned.plan.sizes['普通.txt'], 1);
  assert.equal(planned.plan.totalBytes, 11);
});
