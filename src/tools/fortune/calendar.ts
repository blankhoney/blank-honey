/**
 * 传统历法模块：公历日期 → 农历、节气、四柱。纯函数，不碰 DOM，可在 Node 里直接单测。
 *
 * 口径（页面上原样展示，见 index.html 底部 details）：
 * - 所有日期与时刻都按北京时间的公历民用时刻解释，不随查看者的本机时区变化。
 * - 不做真太阳时修正（经度时差、均时差都不算），也不按出生地换算时区；库没有这项能力，
 *   这里不假装精准。
 * - 年柱、月柱以节气交接时刻为界（立春换年），农历正月初一不换年柱。
 * - 子时流派：显式采用库支持的流派 2「晚子时日柱算当天」。
 *   出处：lunar-typescript 官方文档「八字」篇 https://6tail.cn/calendar/lunar.bazi.html
 *   流派1「晚子时日柱算明天」、流派2「晚子时日柱算当天」、两派都「晚子时时柱算明天」，
 *   且「当不设置流派时，默认采用流派2」。库源码 EightChar#setSect 与 Lunar._computeDay 与之一致。
 * - 节气时刻、干支、农历都取自 lunar-typescript 1.8.6（MIT），不自己实现天文算法。
 *
 * 未知时辰的处理：不猜时柱。时柱 values/wuxing 留空；年/月/日柱由当天 00:00:00 与 23:59:59
 * 两个时刻的盘面比较得出，若两个时刻之间跨了节气，则保留两个取值并给出警告，不用正午冒称确定。
 */

import { Solar } from 'lunar-typescript';

/** 北京时间固定偏移，只用于判断「北京今天」。中国自 1991 年起不再实行夏令时。 */
const BEIJING_UTC_OFFSET_HOURS = 8;

/** 经过实测的可用范围；超出这个区间的节气表不保证完整。 */
const MIN_SOLAR_YEAR = 1900;
const MAX_SOLAR_YEAR = 2100;

/** 子时流派，见文件头出处说明。 */
const ZI_SHI_SECT = 2;

/** 两值柱（时间范围跨节气）的警告文案。 */
const CROSS_TERM_WARNING = '时间范围跨节气，相关柱未定';

export type CivilDate = { year: number; month: number; day: number };

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/**
 * 解析 `YYYY-MM-DD`。只接受这一种写法；范围 1900..2100，并且必须是真实存在的公历日期
 * （含闰日校验——库本身只校验 1..31，二月三十这种假日期要自己拦）。
 */
export function parseDate(text: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) throw new Error('日期要写成 YYYY-MM-DD，例如 2024-02-04。');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_SOLAR_YEAR || year > MAX_SOLAR_YEAR)
    throw new Error(`只支持 ${MIN_SOLAR_YEAR}-01-01 至 ${MAX_SOLAR_YEAR}-12-31 之间的日期。`);
  if (month < 1 || month > 12) throw new Error(`${text} 的月份不存在，月份是 01—12。`);
  if (day < 1 || day > daysInMonth(year, month))
    throw new Error(`${text} 不是真实存在的日期，这个月没有这一天。`);
  return { year, month, day };
}

/** 北京时间的今天，`YYYY-MM-DD`。用 UTC 毫秒加固定偏移再读 UTC 字段，与运行机器时区无关。 */
export function beijingToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + BEIJING_UTC_OFFSET_HOURS * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export type Pillar = { label: string; values: string[]; wuxing: string[] };

interface RawPillars {
  year: string;
  month: string;
  day: string;
  time: string;
  yearWuXing: string;
  monthWuXing: string;
  dayWuXing: string;
  timeWuXing: string;
}

/** `2023-02-30` 这类假日期由 parseDate 拦住，走到这里的一定是真实日期。 */
function pillarsAt(date: CivilDate, hour: number, minute: number, second: number): RawPillars {
  const lunar = Solar.fromYmdHms(date.year, date.month, date.day, hour, minute, second).getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(ZI_SHI_SECT);
  return {
    year: eightChar.getYear(),
    month: eightChar.getMonth(),
    day: eightChar.getDay(),
    time: eightChar.getTime(),
    yearWuXing: eightChar.getYearWuXing(),
    monthWuXing: eightChar.getMonthWuXing(),
    dayWuXing: eightChar.getDayWuXing(),
    timeWuXing: eightChar.getTimeWuXing(),
  };
}

/** 两个时刻取值不同就并列保留（用「或」展示），相同时只有一个。 */
function merge(first: string, second: string): string[] {
  return first === second ? [first] : [first, second];
}

function pillarOf(label: string, values: string[], wuxing: string[]): Pillar {
  return { label, values, wuxing };
}

/** 农历文案只由当日正午的民用日期读出，与四柱的时辰无关。 */
function lunarText(date: CivilDate): string {
  const lunar = Solar.fromYmdHms(date.year, date.month, date.day, 12, 0, 0).getLunar();
  return `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}

/**
 * 由出生公历日期（和可选的已知时刻 `HH:MM`）算出四柱。
 *
 * 已知时刻：比较 `hh:mm:00` 与 `hh:mm:59` 两个时刻；未知时刻（`timeText === null`）：
 * 比较当天 `00:00:00` 与 `23:59:59`，时柱留空。日期或时刻不合法时抛中文 Error。
 */
export function buildChart(
  dateText: string,
  timeText: string | null,
): { lunar: string; pillars: Pillar[]; warnings: string[] } {
  const date = parseDate(dateText);

  let hour = 0;
  let minute = 0;
  if (timeText !== null) {
    const match = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
    if (!match) throw new Error('出生时刻要写成 HH:MM，例如 09:30。');
    hour = Number(match[1]);
    minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new Error('出生时刻超出范围：小时 00—23，分钟 00—59。');
  }

  const known = timeText !== null;
  // 已知时刻：这一分钟的起点与终点。未知时刻：出生当天的起点与终点。
  const from = known ? pillarsAt(date, hour, minute, 0) : pillarsAt(date, 0, 0, 0);
  const to = known ? pillarsAt(date, hour, minute, 59) : pillarsAt(date, 23, 59, 59);

  const pillars: Pillar[] = [
    pillarOf('年柱', merge(from.year, to.year), merge(from.yearWuXing, to.yearWuXing)),
    pillarOf('月柱', merge(from.month, to.month), merge(from.monthWuXing, to.monthWuXing)),
    pillarOf('日柱', merge(from.day, to.day), merge(from.dayWuXing, to.dayWuXing)),
    known
      ? pillarOf('时柱', merge(from.time, to.time), merge(from.timeWuXing, to.timeWuXing))
      : // 时辰未知：时柱不猜，留空由页面写「时柱未定」，也不用正午时柱顶替。
        pillarOf('时柱', [], []),
  ];

  const warnings: string[] = [];
  if (pillars[0].values.length > 1 || pillars[1].values.length > 1)
    warnings.push(CROSS_TERM_WARNING);
  if (!known) warnings.push('出生时辰未知，时柱未定，没有用默认时刻代替。');

  return { lunar: lunarText(date), pillars, warnings };
}

interface TermLike {
  getName(): string;
  getSolar(): Solar;
}

/** 节气文案带完整时刻（含秒），例如 `立春 2024-02-04 16:27:07`。 */
function termText(term: TermLike): string {
  return `${term.getName()} ${term.getSolar().toYmdHms()}`;
}

/**
 * 目标日期的农历与前后节气。正午取样读农历；当天正好交接节气时 `solarTerm` 给出该节气，
 * 否则为空串。`previousTerm`/`nextTerm` 是「前一节气」与「下一节气」，取的是完整二十四节气
 * （不只是十二「节」），按整日比较：当天就是节气日时，前一节气就是当天这个节气。
 */
export function describeDay(dateText: string): {
  lunar: string;
  solarTerm: string;
  previousTerm: string;
  nextTerm: string;
} {
  const date = parseDate(dateText);
  const lunar = Solar.fromYmdHms(date.year, date.month, date.day, 12, 0, 0).getLunar();
  const current = lunar.getCurrentJieQi();
  return {
    lunar: lunarText(date),
    solarTerm: current ? termText(current) : '',
    previousTerm: termText(lunar.getPrevJieQi(true)),
    nextTerm: termText(lunar.getNextJieQi(true)),
  };
}
