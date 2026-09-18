/* 今日小签的页面接线。
 *
 * 顺序固定：校验 → 全部算完 → 一次性替换旧结果。任何一步失败都只显示错误、不动旧结果之外的
 * 输入；输入一变就把旧结果换回空状态，避免把上一份结果误读成这一次的。
 *
 * 隐私：姓名与生日只在内存里，不进 URL、不进日志、不写 localStorage；pagehide 与「清空」
 * 都会丢掉。所有文本都用 textContent 写入，不拼 innerHTML。
 */

import '../shared/style.css';
import './style.css';
import { beijingToday, buildChart, describeDay } from './calendar';
import { dailySign } from './sign';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少必要元素：${selector}`);
  return element;
}

const form = required<HTMLFormElement>('#fortune-form');
const nameInput = required<HTMLInputElement>('#name');
const targetInput = required<HTMLInputElement>('#target');
const birthInput = required<HTMLInputElement>('#birth');
const unknownHourInput = required<HTMLInputElement>('#unknown-hour');
const timeField = required<HTMLElement>('#time-field');
const timeInput = required<HTMLInputElement>('#time');
const errorLine = required<HTMLParagraphElement>('#error');
const resultSlot = required<HTMLDivElement>('#result-slot');

/** 目标日期的默认值：北京时间的今天，也是原生 reset 恢复的值。 */
const TODAY = beijingToday();
targetInput.defaultValue = TODAY;
targetInput.value = TODAY;

function showError(message: string): void {
  errorLine.textContent = message;
}

function clearError(): void {
  errorLine.textContent = '';
}

const EMPTY_STATE_TEXT = '还没有结果。填好左边的信息，按「看今日小签」。';

function hideResult(): void {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = EMPTY_STATE_TEXT;
  resultSlot.replaceChildren(empty);
}

function syncTimeField(): void {
  timeField.hidden = unknownHourInput.checked;
  if (unknownHourInput.checked) timeInput.value = '';
}

function sectionCard(label: string): HTMLElement {
  const card = document.createElement('article');
  card.className = 'result-card fortune-card';
  const heading = document.createElement('h3');
  heading.className = 'result-card__label';
  heading.textContent = label;
  card.append(heading);
  return card;
}

function definitionRow(term: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'fortune-row';
  const key = document.createElement('span');
  key.className = 'fortune-row__key';
  key.textContent = term;
  const detail = document.createElement('b');
  detail.className = 'fortune-row__value';
  detail.textContent = value;
  row.append(key, detail);
  return row;
}

/** 四柱里的一柱：取值可能是「未定」「甲辰」「甲辰 或 丙寅」三种。 */
function pillarCard(label: string, values: string[], wuxing: string[]): HTMLElement {
  const card = document.createElement('article');
  card.className = 'result-card fortune-pillar';

  const heading = document.createElement('h4');
  heading.className = 'result-card__label';
  heading.textContent = label;

  const value = document.createElement('b');
  value.className = 'fortune-pillar__value';
  const undetermined = values.length === 0;
  const crossed = values.length > 1;
  value.textContent = undetermined ? '未定' : values.join(' 或 ');
  if (undetermined || crossed) value.dataset.state = 'undetermined';

  card.append(heading, value);

  if (wuxing.length > 0) {
    const note = document.createElement('small');
    note.className = 'fortune-pillar__wuxing';
    note.textContent = `五行 ${wuxing.join('、')}`;
    card.append(note);
  }
  if (crossed) {
    const note = document.createElement('small');
    note.className = 'fortune-pillar__wuxing';
    note.textContent = '时间范围跨节气，这一柱未定';
    card.append(note);
  }
  return card;
}

function renderResult(
  chart: ReturnType<typeof buildChart>,
  day: ReturnType<typeof describeDay>,
  sign: ReturnType<typeof dailySign>,
  birthText: string,
  targetText: string,
  timeKnown: boolean,
): void {
  const fragments: HTMLElement[] = [];

  const calendarCard = sectionCard('目标日期的历法');
  calendarCard.append(
    definitionRow('公历', targetText),
    definitionRow('农历', day.lunar),
    definitionRow('当天交接节气', day.solarTerm === '' ? '当天没有节气交接' : day.solarTerm),
    definitionRow('前一节气', day.previousTerm),
    definitionRow('下一节气', day.nextTerm),
  );
  fragments.push(calendarCard);

  const pillarsCard = sectionCard('出生四柱');
  const birthLine = document.createElement('p');
  birthLine.className = 'fortune-line';
  birthLine.textContent = `公历 ${birthText}，农历 ${chart.lunar}，${
    timeKnown ? '按已知时刻算' : '时辰未知'
  }。`;
  pillarsCard.append(birthLine);

  const pillarGrid = document.createElement('div');
  pillarGrid.className = 'fortune-pillars';
  for (const pillar of chart.pillars)
    pillarGrid.append(pillarCard(pillar.label, pillar.values, pillar.wuxing));
  pillarsCard.append(pillarGrid);

  if (chart.warnings.length > 0) {
    const list = document.createElement('ul');
    list.className = 'fortune-warnings';
    for (const warning of chart.warnings) {
      const item = document.createElement('li');
      item.textContent = warning;
      list.append(item);
    }
    pillarsCard.append(list);
  }
  fragments.push(pillarsCard);

  const signCard = sectionCard('今日小签 · 娱乐');
  const signTitle = document.createElement('p');
  signTitle.className = 'fortune-sign__title';
  signTitle.textContent = sign.title;
  const signFor = document.createElement('small');
  signFor.className = 'fortune-sign__for';
  signFor.textContent = `为「${sign.name}」抽的签，换名字只换这一张。`;
  const signMessage = document.createElement('p');
  signMessage.className = 'fortune-line';
  signMessage.textContent = sign.message;
  signCard.append(
    signTitle,
    signFor,
    signMessage,
    definitionRow('今日宜', sign.try),
    definitionRow('今日慎', sign.avoid),
  );
  const signNote = document.createElement('small');
  signNote.className = 'fortune-sign__note';
  signNote.textContent = '传统文化与娱乐用途，非科学预测；请勿据此做重要决定。';
  signCard.append(signNote);
  fragments.push(signCard);

  resultSlot.replaceChildren(...fragments);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError();

  const name = nameInput.value;
  const target = targetInput.value;
  const birth = birthInput.value;
  const timeKnown = !unknownHourInput.checked;
  const timeText = timeKnown ? timeInput.value : null;

  try {
    const today = beijingToday();
    if (birth > today) throw new Error('出生日期不能在今天之后。');
    if (birth > target) throw new Error('出生日期不能晚于目标日期。');
    if (timeKnown && timeText === '')
      throw new Error('你选了已知时辰，请补上出生时刻，或者改回「不知道出生时辰」。');

    // 全部算完再替换，避免算到一半留下半份结果。
    const chart = buildChart(birth, timeText);
    const day = describeDay(target);
    const sign = dailySign(name, birth, timeText, target);

    renderResult(chart, day, sign, birth, target, timeKnown);
  } catch (error) {
    showError(error instanceof Error ? error.message : '没能算出结果，请检查输入。');
  }
});

// 输入一变，旧结果就不再对应当前输入，先收回空状态。
form.addEventListener('input', () => {
  clearError();
  hideResult();
});
form.addEventListener('change', () => {
  clearError();
  hideResult();
});

unknownHourInput.addEventListener('change', syncTimeField);

form.addEventListener('reset', () => {
  // 原生 reset 会先把控件恢复成默认值，等这一轮事件结束再同步派生状态。
  queueMicrotask(() => {
    clearError();
    hideResult();
    syncTimeField();
  });
});

// 离开页面就把内存里的个人输入和结果丢掉，不做任何持久化。
window.addEventListener('pagehide', () => {
  nameInput.value = '';
  birthInput.value = '';
  timeInput.value = '';
  unknownHourInput.checked = true;
  targetInput.value = TODAY;
  clearError();
  hideResult();
});

syncTimeField();
hideResult();
