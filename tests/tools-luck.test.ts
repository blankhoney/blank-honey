import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DICE_COUNT_MAX,
  DICE_COUNT_MIN,
  DICE_FACES,
  HISTORY_LIMIT,
  MAX_DRAW_ATTEMPTS,
  MAX_FACES,
  MIN_FACES,
  appendRound,
  assertCount,
  assertFaces,
  describeRound,
  drawFairIndex,
  flipCoin,
  flipCoinRound,
  rollDice,
  rollDiceRound,
  type RandomByteSource,
  type Round,
} from '../src/tools/luck/random';
import { createThrower, SETTLE_MS } from '../src/tools/luck/thrower';

/** 依次吐出预先写好的字节；用完后重新从头开始，避免测试依赖调用次数。 */
function scripted(...values: number[]): { source: RandomByteSource; calls: () => number } {
  let index = 0;
  const source: RandomByteSource = (target) => {
    for (let i = 0; i < target.length; i += 1) {
      target[i] = values[index % values.length]!;
      index += 1;
    }
    return target;
  };
  return { source, calls: () => index };
}

test('公平抽取拒绝落在尾巴上的字节，只在可整除区间内取模', () => {
  // d6：256 % 6 = 4，所以 252–255 落在拒绝区，必须先丢弃再重抽。
  const rejected = scripted(255, 3);
  assert.equal(drawFairIndex(6, rejected.source), 3);
  assert.equal(rejected.calls(), 2, '第一个字节应被拒绝，第二个字节参与取值');

  // 边界：251 是最后一个被接受的字节（0–251 共 252 个，能被 6 整除）。
  assert.equal(drawFairIndex(6, scripted(251).source), 251 % 6);
  // 边界：252 是第一个被拒绝的字节。
  assert.equal(drawFairIndex(6, scripted(252, 0).source), 0);

  // d3：256 % 3 = 1，只有 255 落在拒绝区。
  assert.equal(drawFairIndex(3, scripted(255, 5).source), 5 % 3);

  // 256 面仍然只用一个字节，且不会出现拒绝区。
  assert.equal(drawFairIndex(256, scripted(255).source), 255);

  // 超过 256 面才走两个字节。65536 % 300 = 136，所以 65400–65535 是拒绝区。
  const wideReject = scripted(0xff, 0xd8, 0x00, 0x00);
  assert.equal(drawFairIndex(300, wideReject.source), 0);
  assert.equal(wideReject.calls(), 4, '两个字节被拒绝后换下一对');
  // 边界：65399 是最后一个可接受的两字节值，65400 是第一个被拒绝的值。
  assert.equal(drawFairIndex(300, scripted(0xff, 0x77).source), 65399 % 300);
  assert.equal(65399 % 300, 299);
});

test('随机源持续被拒绝时抛出而不是死循环', () => {
  let calls = 0;
  const alwaysRejected: RandomByteSource = (target) => {
    calls += 1;
    target.fill(255);
    return target;
  };
  assert.throws(() => drawFairIndex(6, alwaysRejected), /拒绝区/);
  assert.equal(calls, MAX_DRAW_ATTEMPTS);
});

test('面数与颗数的区间被严格检查，非法输入抛错而不是静默回退', () => {
  for (const faces of [1, 0, -6, 2.5, 65537, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => assertFaces(faces), RangeError, `面数 ${faces} 应被拒绝`);
  for (const faces of [MIN_FACES, 6, 255, 256, 257, MAX_FACES])
    assert.doesNotThrow(() => assertFaces(faces), `面数 ${faces} 应被接受`);

  for (const count of [0, -1, 1.5, DICE_COUNT_MAX + 1, Number.NaN])
    assert.throws(() => assertCount(count), RangeError, `颗数 ${count} 应被拒绝`);
  for (const count of [DICE_COUNT_MIN, 3, DICE_COUNT_MAX])
    assert.doesNotThrow(() => assertCount(count), `颗数 ${count} 应被接受`);

  assert.throws(() => rollDice(0, 1), RangeError);
  assert.throws(() => rollDice(6, 7), RangeError);
  assert.throws(() => rollDiceRound(6, 0), RangeError);
});

test('每一档骰子的每个点数都能取到，且字节 0 与上界分别给出 1 和最大面', () => {
  for (const faces of DICE_FACES) {
    const seen = new Set<number>();
    // 按可整除区间遍历：小于 limit 的字节正好覆盖所有面各一次。
    const limit = faces <= 256 ? 256 - (256 % faces) : 65536 - (65536 % faces);
    const bytesPerDraw = faces <= 256 ? 1 : 2;
    for (let value = 0; value < Math.min(limit, 4096); value += 1) {
      const bytes = bytesPerDraw === 1 ? [value] : [value >> 8, value & 0xff];
      seen.add(rollDice(faces, 1, scripted(...bytes).source)[0]!);
    }
    assert.equal(seen.size, faces, `d${faces} 应覆盖全部点数`);
    assert.equal(Math.min(...seen), 1, `d${faces} 最小值应为 1`);
    assert.equal(Math.max(...seen), faces, `d${faces} 最大值应为 ${faces}`);
    assert.equal(rollDice(faces, 1, scripted(...(bytesPerDraw === 1 ? [0] : [0, 0])).source)[0], 1);
  }
});

test('同一次调用里多颗骰子各自取值，颗数遵循上限', () => {
  const values = rollDice(6, 3, scripted(0, 1, 2).source);
  assert.deepEqual(values, [1, 2, 3]);
  for (const count of [1, 2, 3, 4, 5, 6])
    assert.equal(rollDice(20, count, scripted(7).source).length, count);
  // d100 仍在单字节范围内：按字节直接取模。
  assert.deepEqual(rollDice(100, 2, scripted(0, 99).source), [1, 100]);
});

test('硬币只有正反两种结果，并按字节奇偶判断', () => {
  assert.equal(flipCoin(scripted(0).source), 'heads');
  assert.equal(flipCoin(scripted(1).source), 'tails');
  assert.equal(flipCoin(scripted(254).source), 'heads');
  assert.equal(flipCoin(scripted(255).source), 'tails');
  const round = flipCoinRound(scripted(1).source);
  assert.equal(round.kind, 'coin');
  assert.equal(round.side, 'tails');
});

test('先定结果再展示：整轮的合计与描述都由已定的点数算出', () => {
  const single = rollDiceRound(20, 1, scripted(19).source);
  assert.deepEqual(single.values, [20]);
  assert.equal(single.total, 20);
  assert.equal(single.kind, 'dice');
  assert.equal(single.faces, 20);

  const multi = rollDiceRound(6, 4, scripted(0, 1, 2, 3).source);
  assert.deepEqual(multi.values, [1, 2, 3, 4]);
  assert.equal(multi.total, 10);
  assert.equal(describeRound(multi), 'd6 × 4：1 + 2 + 3 + 4 = 10');
  assert.equal(describeRound(single), 'd20：20');
  assert.equal(describeRound({ kind: 'coin', side: 'heads' }), '硬币：正面');
  assert.equal(describeRound({ kind: 'coin', side: 'tails' }), '硬币：反面');
});

test('历史只在内存里保留最近 12 轮，最新的排在最前，原数组不被改动', () => {
  const base: readonly Round[] = [];
  let history = appendRound(base, { kind: 'coin', side: 'heads' });
  assert.equal(base.length, 0, '不应改动传入的历史');

  const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => i + 1);
  for (const value of many)
    history = appendRound(history, { kind: 'dice', faces: 6, values: [value], total: value });
  assert.equal(history.length, HISTORY_LIMIT);

  const newest = history[0]!;
  const oldest = history[history.length - 1]!;
  assert.equal(newest.kind === 'dice' && newest.values[0], HISTORY_LIMIT + 5, '最新一轮排在最前');
  assert.equal(oldest.kind === 'dice' && oldest.values[0], 6, '超出上限的旧记录被挤掉');
  assert.equal(
    history.some((round) => round.kind === 'dice' && round.values[0] < 6),
    false,
    '被挤掉的记录不应还在历史里',
  );

  // 重复样本：同样的一轮可以重复出现，历史不做去重。
  let repeats: Round[] = [];
  for (let i = 0; i < 3; i += 1) repeats = appendRound(repeats, { kind: 'coin', side: 'heads' });
  assert.equal(repeats.length, 3);
  assert.deepEqual(repeats, [
    { kind: 'coin', side: 'heads' },
    { kind: 'coin', side: 'heads' },
    { kind: 'coin', side: 'heads' },
  ]);

  // 上限 0 是合法的清空；负数或非整数回退到默认值，而不是把历史清空或无限增长。
  assert.equal(appendRound(history, { kind: 'coin', side: 'tails' }, 0).length, 0);
  assert.equal(appendRound(history, { kind: 'coin', side: 'tails' }, -3).length, HISTORY_LIMIT);
  assert.equal(appendRound(history, { kind: 'coin', side: 'tails' }, 2.5).length, HISTORY_LIMIT);
  assert.equal(appendRound(history, { kind: 'coin', side: 'tails' }, 3).length, 3);
});

test('投掷时间线：动画先开始，0.8 秒后落定，只落定一次', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: string[] = [];
  const thrower = createThrower(
    {
      onStart: (round) => events.push(`start:${describeRound(round)}`),
      onSettle: (round) => events.push(`settle:${describeRound(round)}`),
    },
    { animate: () => true, visible: () => true },
  );
  const round = rollDiceRound(6, 1, scripted(5).source);

  assert.equal(thrower.present(round), true);
  assert.equal(thrower.busy, true);
  assert.deepEqual(events, ['start:d6：6'], '结果在动画开始时就已经确定');

  t.mock.timers.tick(SETTLE_MS - 1);
  assert.equal(thrower.busy, true, '不到时间不落定');

  t.mock.timers.tick(1);
  assert.deepEqual(events, ['start:d6：6', 'settle:d6：6']);
  assert.equal(thrower.busy, false);

  // 落定之后不会再被调用一次。
  t.mock.timers.tick(SETTLE_MS * 3);
  assert.equal(events.length, 2);
});

test('投掷时间线：忙态不隐式重抽，也不打断正在动画的一轮', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const settled: number[] = [];
  const thrower = createThrower(
    {
      onStart: () => {},
      onSettle: (round) => settled.push(round.kind === 'dice' ? round.values[0]! : -1),
    },
    { animate: () => true, visible: () => true },
  );
  const first = rollDiceRound(6, 1, scripted(0).source); // 1
  const second = rollDiceRound(6, 1, scripted(5).source); // 6

  assert.equal(thrower.present(first), true);
  assert.equal(thrower.present(second), false, '动画期间第二次投掷被拒绝');
  t.mock.timers.tick(SETTLE_MS);
  assert.deepEqual(settled, [1], '落定的是第一次的结果');

  // 落定之后可以正常开始新的一轮。
  assert.equal(thrower.present(second), true);
  t.mock.timers.tick(SETTLE_MS);
  assert.deepEqual(settled, [1, 6]);
});

test('投掷时间线：减少动效或页面隐藏时立即出结果，不留定时器', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [animate, visible] of [
    [false, true],
    [true, false],
    [false, false],
  ] as const) {
    const events: string[] = [];
    const thrower = createThrower(
      { onStart: () => events.push('start'), onSettle: () => events.push('settle') },
      { animate: () => animate, visible: () => visible },
    );
    assert.equal(thrower.present({ kind: 'coin', side: 'heads' }), true);
    assert.deepEqual(
      events,
      ['start', 'settle'],
      `animate=${animate} visible=${visible} 应立即落定`,
    );
    assert.equal(thrower.busy, false);
    t.mock.timers.tick(SETTLE_MS * 3);
    assert.deepEqual(events, ['start', 'settle'], '不应再有第二次回调');
  }
});

test('投掷时间线：页面隐藏时 settleNow 立即落定，dispose 丢掉未完成的一轮', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const settled: string[] = [];
  const thrower = createThrower(
    { onStart: () => {}, onSettle: (round) => settled.push(describeRound(round)) },
    { animate: () => true, visible: () => true },
  );

  thrower.present({ kind: 'coin', side: 'tails' });
  thrower.settleNow();
  assert.deepEqual(settled, ['硬币：反面']);
  assert.equal(thrower.busy, false);
  thrower.settleNow();
  assert.deepEqual(settled, ['硬币：反面'], '重复落定是空操作');

  thrower.present({ kind: 'coin', side: 'heads' });
  thrower.dispose();
  t.mock.timers.tick(SETTLE_MS * 3);
  assert.deepEqual(settled, ['硬币：反面'], 'dispose 之后不再有回调');
  assert.equal(thrower.busy, false);
});

test('默认的随机源是 Web Crypto，不会退化成 Math.random', () => {
  const original = globalThis.crypto;
  let used = 0;
  const stub = {
    getRandomValues: <T extends ArrayBufferView>(target: T): T => {
      used += 1;
      const view = target as unknown as Uint8Array;
      view.fill(3);
      return target;
    },
  };
  Object.defineProperty(globalThis, 'crypto', { value: stub, configurable: true, writable: true });
  try {
    assert.deepEqual(rollDice(6, 2), [4, 4]);
    assert.equal(flipCoin(), 'tails');
    assert.ok(used >= 3, '默认路径应调用注入的 crypto.getRandomValues');
  } finally {
    Object.defineProperty(globalThis, 'crypto', {
      value: original,
      configurable: true,
      writable: true,
    });
  }

  Object.defineProperty(globalThis, 'crypto', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  try {
    assert.throws(() => rollDice(6, 1), /Web Crypto/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', {
      value: original,
      configurable: true,
      writable: true,
    });
  }
});

test('d100 的两位数字号与 d6 的点数走不同渲染分支的数据都在范围内', () => {
  // 这是渲染层选择「点」还是「数字」的判据，面数上限不引入新的代码路径。
  for (const faces of DICE_FACES) {
    const round = rollDiceRound(faces, DICE_COUNT_MAX, scripted(0).source);
    assert.equal(
      round.values.every((value) => value >= 1 && value <= faces),
      true,
    );
    assert.equal(round.total, DICE_COUNT_MAX);
  }
});
