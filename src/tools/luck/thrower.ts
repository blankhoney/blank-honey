/* 投掷时间线：约 0.8 秒后把已经定下的结果亮出来；
 * 减少动效或页面隐藏时立即落定；页面离开用 dispose 清掉定时器。
 * 不碰 DOM，定时器用全局 setTimeout，便于测试里替换。
 */

import type { Round } from './random';

export const SETTLE_MS = 800;

export interface ThrowerHooks {
  onStart(round: Round): void;
  /** 一轮只调用一次。 */
  onSettle(round: Round): void;
}

export interface ThrowerOptions {
  /** 通常读 prefers-reduced-motion。 */
  animate: () => boolean;
  visible: () => boolean;
  settleMs?: number;
}

export interface Thrower {
  /** 正在投掷时返回 false：忙态不隐式重抽，也不打断当前一轮。 */
  present(round: Round): boolean;
  settleNow(): void;
  readonly busy: boolean;
  dispose(): void;
}

export function createThrower(hooks: ThrowerHooks, options: ThrowerOptions): Thrower {
  const settleMs = options.settleMs ?? SETTLE_MS;

  /** 回调带回自己的令牌，过期令牌被丢弃。 */
  let token = 0;
  let pending: Round | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer(): void {
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    settleTimer = undefined;
  }

  function settle(current: number): void {
    if (pending === null || current !== token) return;
    const round = pending;
    pending = null; // 先清忙态，钩子里再触发新的一轮也不会被打断
    clearTimer();
    hooks.onSettle(round);
  }

  return {
    get busy(): boolean {
      return pending !== null;
    },

    present(round: Round): boolean {
      if (pending !== null) return false;
      token += 1;
      const current = token;
      pending = round;
      hooks.onStart(round);
      if (!options.animate() || !options.visible()) {
        settle(current);
        return true;
      }
      settleTimer = setTimeout(() => settle(current), settleMs);
      return true;
    },

    settleNow(): void {
      settle(token);
    },

    dispose(): void {
      token += 1;
      pending = null;
      clearTimer();
    },
  };
}
