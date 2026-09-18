/**
 * 娱乐区的今日小签。纯函数：同样的姓名 + 出生信息 + 目标日期永远得到同一支签。
 *
 * - 姓名只在这里参与选签，绝不进入任何干支推算（四柱看 calendar.ts）。
 * - 不用加密能力、不联网、不写 localStorage / URL / console：只要一个稳定的整数哈希。
 *   内容本身是娱乐文案，不需要抗篡改，所以 FNV-1a 32 位足够。
 * - 签文只给日常建议（散步、整理、联系朋友、休息、专注小事），不做疾病、财富、
 *   吉凶应验之类预测，也不写「准确率」「灵验」这类话。
 */

/** 选签用的哈希初值与乘子（FNV-1a 32 位）。 */
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const SIGNS = [
  {
    title: '慢慢发芽',
    message: '今天适合把一件拖着的小事往前挪一点，不求一次做完。',
    try: '做一件小事',
    avoid: '别急着下结论',
  },
  {
    title: '顺手之日',
    message: '今天适合顺着已有的节奏做事，手边的先收好，再开新的。',
    try: '整理手边的东西',
    avoid: '别同时开太多事',
  },
  {
    title: '风来时',
    message: '今天适合留一点余量给变化，计划被改了就跟着改。',
    try: '散步一会儿',
    avoid: '别把话说满',
  },
  {
    title: '收拾心绪',
    message: '今天适合把混在一起的事情分开，先看清有几件。',
    try: '列一张短清单',
    avoid: '别在烦躁时做决定',
  },
  {
    title: '小小相逢',
    message: '今天适合联系一位久没说话的朋友，聊几句近况就好。',
    try: '给朋友发条消息',
    avoid: '别拿别人的进度比自己',
  },
  {
    title: '留白一格',
    message: '今天适合空出一段时间不安排，发呆也算。',
    try: '留半小时空白',
    avoid: '别把时间塞满',
  },
  {
    title: '先稳后行',
    message: '今天适合先把要紧的事确认清楚，再决定后面的安排。',
    try: '确认一件要紧的事',
    avoid: '别只凭猜想往前走',
  },
  {
    title: '试着开始',
    message: '今天适合挑一件一直想做的事，只做开头那一步。',
    try: '做五分钟开头',
    avoid: '别等状态完美再动',
  },
] as const;

/** 姓名规范化：NFKC、去首尾空白、内部空白合并成一个半角空格。 */
function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

/**
 * 今日小签。`name` 是用户输入的名字（只用于挑选与显示），`birth`、`time`、`target`
 * 只作为稳定输入的组成部分；姓名不合法（空或超过 40 个字）时抛中文 Error。
 */
export function dailySign(
  name: string,
  birth: string,
  time: string | null,
  target: string,
): { name: string; title: string; message: string; try: string; avoid: string } {
  const normalized = normalizeName(name);
  const length = [...normalized].length;
  if (length === 0) throw new Error('请填一个名字，这个名字只用来选签。');
  if (length > 40) throw new Error('名字最多 40 个字，短一点也能选签。');

  const seed = JSON.stringify([normalized, birth, time, target]);
  let hash = FNV_OFFSET;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  const sign = SIGNS[hash % SIGNS.length]!;
  return {
    name: normalized,
    title: sign.title,
    message: sign.message,
    try: sign.try,
    avoid: sign.avoid,
  };
}
