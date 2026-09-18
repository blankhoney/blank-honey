/* 公平好运的纯随机核心：结果只来自 Web Crypto 的拒绝采样，不用 Math.random。
 * 随机源可注入（签名同 crypto.getRandomValues），测试喂确定的字节序列。
 */

/** 与 `crypto.getRandomValues` 兼容。 */
export type RandomByteSource = (target: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

/** 2 面即硬币；上界 65536 用两个字节采样。 */
export const MIN_FACES = 2;
export const MAX_FACES = 65536;

export const DICE_FACES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DiceFaceCount = (typeof DICE_FACES)[number];

export const DICE_COUNT_MIN = 1;
export const DICE_COUNT_MAX = 6;

/** 历史只保留最近多少轮（仅内存）。 */
export const HISTORY_LIMIT = 12;

/** 只用来保证不会死循环，正常随机源走不到这里。 */
export const MAX_DRAW_ATTEMPTS = 1024;

export type CoinSide = 'heads' | 'tails';

export interface DiceRound {
  kind: 'dice';
  /** 面数，例如 6 表示 d6。 */
  faces: number;
  /** 每颗骰子的点数，顺序即骰子顺序，长度 1–6。 */
  values: number[];
  /** 点数之和，方便直接展示。 */
  total: number;
}

export interface CoinRound {
  kind: 'coin';
  side: CoinSide;
}

export type Round = DiceRound | CoinRound;

const DEFAULT_SOURCE: RandomByteSource = (target) => {
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== 'function')
    throw new Error('当前环境没有 Web Crypto，无法本地生成公平随机数');
  return source.getRandomValues(target);
};

/** 面数必须是区间内的整数，否则抛错而不是静默回退到别的取值。 */
export function assertFaces(faces: number): void {
  if (!Number.isInteger(faces) || faces < MIN_FACES || faces > MAX_FACES)
    throw new RangeError(`面数必须是 ${MIN_FACES} 到 ${MAX_FACES} 之间的整数`);
}

export function assertCount(count: number): void {
  if (!Number.isInteger(count) || count < DICE_COUNT_MIN || count > DICE_COUNT_MAX)
    throw new RangeError(`骰子颗数必须是 ${DICE_COUNT_MIN} 到 ${DICE_COUNT_MAX} 之间的整数`);
}

/**
 * 拒绝采样取 `[0, faces)`：面数 ≤ 256 采一个字节，否则两个字节。把 `[limit, span)`
 * 这一段丢掉重抽，剩下的区间能被面数整除，所以每一面等概率。
 */
export function drawFairIndex(faces: number, source: RandomByteSource = DEFAULT_SOURCE): number {
  assertFaces(faces);
  const bytesPerDraw = faces <= 256 ? 1 : 2;
  const span = bytesPerDraw === 1 ? 256 : 65536;
  const limit = span - (span % faces);
  const buffer = new Uint8Array(bytesPerDraw);
  for (let attempt = 0; attempt < MAX_DRAW_ATTEMPTS; attempt += 1) {
    source(buffer);
    let value = 0;
    for (const byte of buffer) value = value * 256 + byte;
    if (value < limit) return value % faces;
  }
  throw new Error('随机源连续落在拒绝区，已中止以避免卡死');
}

/** 返回 1–faces。 */
export function rollDie(faces: number, source?: RandomByteSource): number {
  return drawFairIndex(faces, source) + 1;
}

export function rollDice(faces: number, count: number, source?: RandomByteSource): number[] {
  assertFaces(faces);
  assertCount(count);
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) values.push(rollDie(faces, source));
  return values;
}

export function flipCoin(source?: RandomByteSource): CoinSide {
  return drawFairIndex(2, source) === 0 ? 'heads' : 'tails';
}

/** 结果在这里定下，之后只交给动画展示。 */
export function rollDiceRound(faces: number, count: number, source?: RandomByteSource): DiceRound {
  const values = rollDice(faces, count, source);
  return {
    kind: 'dice',
    faces,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

export function flipCoinRound(source?: RandomByteSource): CoinRound {
  return { kind: 'coin', side: flipCoin(source) };
}

/** 最新的在前面并裁到 limit 条；不改动传入的历史。limit 为 0 即清空，非法值按 HISTORY_LIMIT。 */
export function appendRound(
  history: readonly Round[],
  round: Round,
  limit: number = HISTORY_LIMIT,
): Round[] {
  const size = Number.isInteger(limit) && limit >= 0 ? limit : HISTORY_LIMIT;
  return [round, ...history].slice(0, size);
}

/** 界面与测试共用的结果描述。 */
export function describeRound(round: Round): string {
  if (round.kind === 'coin') return `硬币：${round.side === 'heads' ? '正面' : '反面'}`;
  const label = `d${round.faces}`;
  if (round.values.length === 1) return `${label}：${round.values[0]}`;
  return `${label} × ${round.values.length}：${round.values.join(' + ')} = ${round.total}`;
}
