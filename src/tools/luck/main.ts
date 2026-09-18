/* 页面接线：结果先定下，再交给 thrower.ts 展示；动画只是装饰性翻动，不参与取值。 */

import '../shared/style.css';
import './style.css';
import {
  DICE_COUNT_MAX,
  DICE_FACES,
  HISTORY_LIMIT,
  appendRound,
  describeRound,
  flipCoinRound,
  rollDiceRound,
  type Round,
} from './random';
import { createThrower } from './thrower';

/** 装饰性翻动的间隔；落定时间在 thrower 里。 */
const FLICKER_MS = 90;
const IDLE_STATUS = '结果会在这里用文字说明，方便读屏软件朗读。';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 1–6 点的骰面圆心，64×64 视图盒。 */
const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[32, 32]],
  2: [
    [19, 19],
    [45, 45],
  ],
  3: [
    [19, 19],
    [32, 32],
    [45, 45],
  ],
  4: [
    [19, 19],
    [45, 19],
    [19, 45],
    [45, 45],
  ],
  5: [
    [19, 19],
    [45, 19],
    [32, 32],
    [19, 45],
    [45, 45],
  ],
  6: [
    [19, 19],
    [45, 19],
    [19, 32],
    [45, 32],
    [19, 45],
    [45, 45],
  ],
};

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`缺少必要元素：${selector}`);
  return element;
}

const stage = required<HTMLDivElement>(document, '#stage');
const status = required<HTMLParagraphElement>(document, '#status');
const stageMode = required<HTMLElement>(document, '#stage-mode');
const rollButton = required<HTMLButtonElement>(document, '#roll');
const clearButton = required<HTMLButtonElement>(document, '#clear');
const modeDice = required<HTMLButtonElement>(document, '#mode-dice');
const modeCoin = required<HTMLButtonElement>(document, '#mode-coin');
const facesField = required<HTMLElement>(document, '#faces-field');
const countField = required<HTMLElement>(document, '#count-field');
const facesButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#faces .choice'));
const countButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#counts .choice'));
const historySlot = required<HTMLDivElement>(document, '#history-slot');
const historyCount = required<HTMLElement>(document, '#history-count');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

type Mode = 'dice' | 'coin';

let mode: Mode = 'dice';
let faces = 6;
let count = 1;
let history: Round[] = [];

/** 落定时按这些写值函数出结果。 */
let diceSetters: Array<(value: number) => void> = [];
let coinFace: ((side: 'heads' | 'tails') => void) | null = null;
let flickerTimer: number | undefined;

/* ---------- 绘制 ---------- */

function createDie(
  faceCount: number,
  index: number,
): { element: SVGSVGElement; setValue: (value: number) => void } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'die');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.setProperty('--die-index', String(index));

  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('class', 'die-body');
  body.setAttribute('x', '4');
  body.setAttribute('y', '4');
  body.setAttribute('width', '56');
  body.setAttribute('height', '56');
  body.setAttribute('rx', '14');
  svg.append(body);

  // 小面数用点，大面数用数字：d12 以上画点会看不清。
  if (faceCount <= 6) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'die-pips');
    svg.append(group);
    return {
      element: svg,
      setValue: (value) => {
        group.replaceChildren();
        for (const [cx, cy] of PIP_LAYOUT[value] ?? PIP_LAYOUT[1]) {
          const pip = document.createElementNS(SVG_NS, 'circle');
          pip.setAttribute('cx', String(cx));
          pip.setAttribute('cy', String(cy));
          pip.setAttribute('r', '5.4');
          group.append(pip);
        }
      },
    };
  }

  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('class', 'die-number');
  text.setAttribute('x', '32');
  text.setAttribute('y', '34');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  svg.append(text);
  return {
    element: svg,
    setValue: (value) => {
      const label = String(value);
      text.textContent = label;
      // 位数越多字号越小，三位数也能待在骰面里。
      text.setAttribute('font-size', label.length > 2 ? '24' : label.length > 1 ? '30' : '34');
    },
  };
}

function createCoin(): { element: HTMLDivElement; setSide: (side: 'heads' | 'tails') => void } {
  const coin = document.createElement('div');
  coin.className = 'coin';
  coin.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'coin-label';
  coin.append(label);
  return {
    element: coin,
    setSide: (side) => {
      coin.classList.toggle('is-heads', side === 'heads');
      coin.classList.toggle('is-tails', side === 'tails');
      label.textContent = side === 'heads' ? '正' : '反';
    },
  };
}

/** 装饰性翻动：固定序列，与真实取值无关。 */
function flickerValue(faceCount: number, index: number, tick: number): number {
  return ((tick * 3 + index * 2) % faceCount) + 1;
}

function stopFlicker(): void {
  if (flickerTimer !== undefined) window.clearInterval(flickerTimer);
  flickerTimer = undefined;
}

/* ---------- 界面状态 ---------- */

function renderControls(): void {
  modeDice.setAttribute('aria-pressed', String(mode === 'dice'));
  modeCoin.setAttribute('aria-pressed', String(mode === 'coin'));
  for (const button of facesButtons)
    button.setAttribute('aria-pressed', String(Number(button.dataset.faces) === faces));
  for (const button of countButtons)
    button.setAttribute('aria-pressed', String(Number(button.dataset.count) === count));
  facesField.hidden = mode === 'coin';
  countField.hidden = mode === 'coin';
  rollButton.textContent = mode === 'coin' ? '抛硬币' : '投骰子';
  stageMode.textContent =
    mode === 'coin' ? '硬币模式 · 正反两面' : `骰子模式 · d${faces} · ${count} 颗`;
}

function renderHistory(): void {
  historyCount.textContent = `最近 ${history.length} / ${HISTORY_LIMIT} 轮`;
  if (history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '这一轮还没有记录。每投一次，这里留下最近 12 轮。';
    historySlot.replaceChildren(empty);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'history';
  for (const round of history) {
    const item = document.createElement('li');
    const value = document.createElement('b');
    value.textContent =
      round.kind === 'coin' ? (round.side === 'heads' ? '正面' : '反面') : round.values.join(' · ');
    const label = document.createElement('span');
    label.textContent = describeRound(round);
    item.append(value, label);
    list.append(item);
  }
  historySlot.replaceChildren(list);
}

function setStatus(text: string, tone?: 'busy' | 'ok'): void {
  status.textContent = text;
  if (tone) status.dataset.tone = tone;
  else status.removeAttribute('data-tone');
}

function setBusy(next: boolean): void {
  // 主按钮保留焦点：用 aria-disabled 而不是 disabled，忙态点击在事件里被忽略，不会隐式重抽。
  rollButton.setAttribute('aria-disabled', String(next));
  clearButton.disabled = next;
  for (const button of [...facesButtons, ...countButtons, modeDice, modeCoin])
    button.disabled = next;
}

/* ---------- 时间线 ---------- */

const thrower = createThrower(
  {
    onStart(round) {
      stopFlicker();
      setBusy(true);
      setStatus('正在投掷…', 'busy');
      stage.replaceChildren();
      stage.classList.add('is-rolling');
      diceSetters = [];
      coinFace = null;

      if (round.kind === 'coin') {
        const coin = createCoin();
        coinFace = coin.setSide;
        coin.element.classList.add('is-flipping');
        stage.append(coin.element);
        return;
      }

      round.values.forEach((_value, index) => {
        const die = createDie(round.faces, index);
        diceSetters.push(die.setValue);
        stage.append(die.element);
      });
      // 装饰性翻动；真实结果已经在待落定的那一轮里。
      let tick = 0;
      const paint = () => {
        tick += 1;
        diceSetters.forEach((setValue, index) => setValue(flickerValue(round.faces, index, tick)));
      };
      paint();
      if (!reducedMotion.matches && document.visibilityState === 'visible')
        flickerTimer = window.setInterval(paint, FLICKER_MS);
    },

    onSettle(round) {
      stopFlicker();
      if (round.kind === 'coin') coinFace?.(round.side);
      else round.values.forEach((value, index) => diceSetters[index]?.(value));

      stage.classList.remove('is-rolling');
      // 投掷台只是图形，结果由上面的 status 播报。
      history = appendRound(history, round);
      renderHistory();
      setStatus(describeRound(round), 'ok');
      setBusy(false);
    },
  },
  {
    animate: () => !reducedMotion.matches,
    visible: () => document.visibilityState === 'visible',
  },
);

/* ---------- 事件 ---------- */

function throwNow(): void {
  // 忙态不隐式重抽：present 会拒绝第二次调用。
  thrower.present(mode === 'coin' ? flipCoinRound() : rollDiceRound(faces, count));
}

rollButton.addEventListener('click', () => {
  if (thrower.busy) return;
  throwNow();
});

clearButton.addEventListener('click', () => {
  history = [];
  renderHistory();
  setStatus('记录已清空，这一轮结果仍在上面。');
});

modeDice.addEventListener('click', () => {
  mode = 'dice';
  renderControls();
});

modeCoin.addEventListener('click', () => {
  mode = 'coin';
  renderControls();
});

for (const button of facesButtons)
  button.addEventListener('click', () => {
    faces = Number(button.dataset.faces);
    renderControls();
  });

for (const button of countButtons)
  button.addEventListener('click', () => {
    count = Math.min(Number(button.dataset.count), DICE_COUNT_MAX);
    renderControls();
  });

// 标签页被藏起来时动画没有观众：直接落定，避免恢复可见时还停在半路。
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') thrower.settleNow();
});

// 界面按钮的面数必须来自 random.ts 的常量，避免两边漂移。
for (const button of facesButtons) {
  const value = Number(button.dataset.faces);
  if (!(DICE_FACES as readonly number[]).includes(value))
    throw new Error(`未知骰子面数：${button.dataset.faces}`);
}
for (const button of countButtons) {
  const value = Number(button.dataset.count);
  if (!Number.isInteger(value) || value < 1 || value > DICE_COUNT_MAX)
    throw new Error(`未知骰子颗数：${button.dataset.count}`);
}

renderControls();
renderHistory();
setStatus(IDLE_STATUS);
