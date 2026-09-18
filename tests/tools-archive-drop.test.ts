import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readDroppedEntries, type DroppedItem } from '../src/tools/archive/drop';
import { normalizeEntryName, type Limits } from '../src/tools/archive/plan';

/**
 * 这些测试用结构类型假条目（只实现被用到的字段），不引入任何浏览器框架：
 * drop.ts 只认 isFile / isDirectory / name / file() / createReader() 这几个形状。
 */

const LIMITS: Limits = {
  inputBytes: 1024 * 1024,
  expandedBytes: 4 * 1024 * 1024,
  entries: 100,
};

const alive = () => true;

function fileEntry(name: string, size: number): FileSystemEntry {
  return {
    name,
    isFile: true,
    isDirectory: false,
    file: (resolve: (file: File) => void) => resolve({ size } as File),
  } as unknown as FileSystemEntry;
}

/** batches 按 readEntries 的调用顺序返回，模拟一次最多 100 条的浏览器行为。 */
function dirEntry(
  name: string,
  batches: FileSystemEntry[][],
  onRead?: () => void,
): FileSystemEntry {
  let index = 0;
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => ({
      readEntries: (resolve: (entries: FileSystemEntry[]) => void) => {
        onRead?.();
        resolve(batches[index++] ?? []);
      },
    }),
  } as unknown as FileSystemEntry;
}

function foreignEntry(name: string): FileSystemEntry {
  return { name, isFile: false, isDirectory: false } as unknown as FileSystemEntry;
}

function namesOf(items: DroppedItem[]): string[] {
  return items.map((item) => item.name);
}

test('中文嵌套路径与空目录都保留相对路径，file:null 只给空目录', async () => {
  const tree = dirEntry('资料', [
    [
      fileEntry('说明.txt', 10),
      dirEntry('照片', [[fileEntry('风景.jpg', 2048), dirEntry('空相册', [[]])]]),
    ],
    [],
  ]);
  const items = await readDroppedEntries([tree], LIMITS, alive);
  assert.deepEqual(namesOf(items), ['资料/说明.txt', '资料/照片/风景.jpg', '资料/照片/空相册']);
  assert.equal(items[0].file?.size, 10);
  assert.equal(items[1].file?.size, 2048);
  assert.equal(items[2].file, null);
  // 非空目录「资料」与「照片」都不作为条目出现，只有空目录带 file:null。
  assert.equal(items.filter((item) => item.file === null).length, 1);
});

test('顶层普通文件与顶层空目录也走同一条规则', async () => {
  const items = await readDroppedEntries(
    [fileEntry('笔记.md', 3), dirEntry('空目录', [[]])],
    LIMITS,
    alive,
  );
  assert.deepEqual(namesOf(items), ['笔记.md', '空目录']);
  assert.equal(items[0].file?.size, 3);
  assert.equal(items[1].file, null);
});

test('readEntries 分多批返回时一直读到空批，不止读第一批', async () => {
  const tree = dirEntry('大目录', [
    [fileEntry('a.txt', 1), fileEntry('b.txt', 2)],
    [fileEntry('c.txt', 3)],
    [],
  ]);
  const items = await readDroppedEntries([tree], LIMITS, alive);
  assert.deepEqual(namesOf(items), ['大目录/a.txt', '大目录/b.txt', '大目录/c.txt']);
  assert.deepEqual(
    items.map((item) => item.file?.size),
    [1, 2, 3],
  );
});

test('空目录要读到空批才成立，中间批次为空不当成空目录', async () => {
  // 第一批非空、第二批为空：目录非空，不该产生 file:null 条目。
  const tree = dirEntry('有内容', [[fileEntry('子项.bin', 8)], []]);
  const items = await readDroppedEntries([tree], LIMITS, alive);
  assert.deepEqual(namesOf(items), ['有内容/子项.bin']);
});

test('目录穿越条目被拒，错误文案含「名称」或「安全」', async () => {
  const tree = dirEntry('父目录', [[fileEntry('..', 1)], []]);
  await assert.rejects(readDroppedEntries([tree], LIMITS, alive), (error: Error) => {
    assert.match(error.message, /名称|安全/);
    return true;
  });
});

test('条目名自带分隔符或绝对路径被拒', async () => {
  await assert.rejects(readDroppedEntries([fileEntry('a/b.txt', 1)], LIMITS, alive), /名称|安全/);
  await assert.rejects(readDroppedEntries([fileEntry('C:', 1)], LIMITS, alive), /名称|安全/);
});

test('空名字条目被拒', async () => {
  await assert.rejects(readDroppedEntries([fileEntry('', 1)], LIMITS, alive), /名称|安全/);
});

test('多个文件的真实 size 累计超过 inputBytes 时拒绝，文案含「上限」', async () => {
  const limits: Limits = { ...LIMITS, inputBytes: 2500 };
  const tree = dirEntry('包', [
    [fileEntry('一.bin', 1000), fileEntry('二.bin', 1000), fileEntry('三.bin', 1000)],
    [],
  ]);
  await assert.rejects(readDroppedEntries([tree], limits, alive), (error: Error) => {
    assert.match(error.message, /上限/);
    return true;
  });
});

test('恰好等于 inputBytes 不算超限', async () => {
  const limits: Limits = { ...LIMITS, inputBytes: 2000 };
  const items = await readDroppedEntries(
    [fileEntry('一.bin', 1000), fileEntry('二.bin', 1000)],
    limits,
    alive,
  );
  assert.equal(items.length, 2);
});

test('目录条目本身也计入 entries', async () => {
  const limits: Limits = { ...LIMITS, entries: 2 };
  // 目录「包」自身 + 两个文件 = 3 > 2。
  const tree = dirEntry('包', [[fileEntry('一.txt', 1), fileEntry('二.txt', 1)], []]);
  await assert.rejects(readDroppedEntries([tree], limits, alive), (error: Error) => {
    assert.match(error.message, /上限/);
    return true;
  });
});

test('单批 readEntries 超过 entries 立即拒绝，不再继续读该目录', async () => {
  const limits: Limits = { ...LIMITS, entries: 3 };
  let reads = 0;
  const tree = dirEntry(
    '包',
    [[fileEntry('1', 1), fileEntry('2', 1), fileEntry('3', 1), fileEntry('4', 1)], []],
    () => {
      reads += 1;
    },
  );
  await assert.rejects(readDroppedEntries([tree], limits, alive), (error: Error) => {
    assert.match(error.message, /上限/);
    return true;
  });
  // 第一批就超限，没有读到空批。
  assert.equal(reads, 1);
});

test('非文件非目录的条目被拒', async () => {
  await assert.rejects(
    readDroppedEntries([foreignEntry('怪东西')], LIMITS, alive),
    (error: Error) => {
      assert.match(error.message, /不支持这个目录条目/);
      return true;
    },
  );
});

test('file() 挂起期间被取消：reject「已取消目录读取」，不给结果', async () => {
  let resolveFile: ((file: File) => void) | undefined;
  const pending = {
    name: '慢文件.bin',
    isFile: true,
    isDirectory: false,
    file: (resolve: (file: File) => void) => {
      resolveFile = resolve;
    },
  } as unknown as FileSystemEntry;
  let running = true;
  const promise = readDroppedEntries([pending], LIMITS, () => running);
  await Promise.resolve();
  running = false;
  resolveFile!({ size: 1 } as File);
  await assert.rejects(promise, (error: Error) => error.message === '已取消目录读取');
});

test('readEntries 挂起期间被取消：reject「已取消目录读取」', async () => {
  let resolveBatch: ((entries: FileSystemEntry[]) => void) | undefined;
  const pending = {
    name: '慢目录',
    isFile: false,
    isDirectory: true,
    createReader: () => ({
      readEntries: (resolve: (entries: FileSystemEntry[]) => void) => {
        resolveBatch = resolve;
      },
    }),
  } as unknown as FileSystemEntry;
  let running = true;
  const promise = readDroppedEntries([pending], LIMITS, () => running);
  await Promise.resolve();
  running = false;
  resolveBatch!([fileEntry('子项.txt', 1)]);
  await assert.rejects(promise, (error: Error) => error.message === '已取消目录读取');
});

test('进入条目之前就已取消就不开始读', async () => {
  let reads = 0;
  const tree = dirEntry('包', [[]], () => {
    reads += 1;
  });
  await assert.rejects(
    readDroppedEntries([tree], LIMITS, () => false),
    /已取消目录读取/,
  );
  assert.equal(reads, 0);
});

test('reader 的 reject 原样抛给调用方', async () => {
  const boom = new Error('磁盘读不动了');
  const failing = {
    name: '坏目录',
    isFile: false,
    isDirectory: true,
    createReader: () => ({
      readEntries: (_resolve: (entries: FileSystemEntry[]) => void, reject: (e: Error) => void) =>
        reject(boom),
    }),
  } as unknown as FileSystemEntry;
  await assert.rejects(readDroppedEntries([failing], LIMITS, alive), (error: Error) => {
    assert.equal(error, boom);
    return true;
  });
});

test('file() 的 reject 原样抛给调用方', async () => {
  const boom = new Error('文件取不到');
  const failing = {
    name: '坏文件.txt',
    isFile: true,
    isDirectory: false,
    file: (_resolve: (file: File) => void, reject: (e: Error) => void) => reject(boom),
  } as unknown as FileSystemEntry;
  await assert.rejects(readDroppedEntries([failing], LIMITS, alive), (error: Error) => {
    assert.equal(error, boom);
    return true;
  });
});

test('大小错误的文案含「上限」', async () => {
  const limits: Limits = { ...LIMITS, inputBytes: 4 };
  const error = await readDroppedEntries([fileEntry('大文件.bin', 5)], limits, alive).then(
    () => null,
    (reason: Error) => reason,
  );
  assert.ok(error);
  assert.match(error.message, /上限/);
});

test('读出的相对路径直接可用，父路径由前缀自然保留', async () => {
  const items = await readDroppedEntries(
    [dirEntry('外层', [[dirEntry('内层', [[fileEntry('末.文件', 4)], []])], []])],
    LIMITS,
    alive,
  );
  assert.deepEqual(namesOf(items), ['外层/内层/末.文件']);
  assert.equal(items[0].file?.size, 4);
  // 名字能直接送进 plan.ts 的规范化而不会被拒。
  const verdict = normalizeEntryName(items[0].name);
  assert.equal(verdict.ok, true);
});
