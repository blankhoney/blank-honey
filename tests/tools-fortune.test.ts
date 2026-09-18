import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beijingToday, buildChart, describeDay, parseDate } from '../src/tools/fortune/calendar';
import { dailySign } from '../src/tools/fortune/sign';

/** 四柱按「年/月/日/时」顺序取；未定或跨节气时用 ` | ` 连起来，方便断言。 */
function pillarsOf(dateText: string, timeText: string | null): string[] {
  return buildChart(dateText, timeText).pillars.map((pillar) => pillar.values.join(' | '));
}

function labelsOf(dateText: string, timeText: string | null): string[] {
  return buildChart(dateText, timeText).pillars.map((pillar) => pillar.label);
}

test('parseDate 只接受 YYYY-MM-DD，并校验真实日期与范围', () => {
  assert.deepEqual(parseDate('2024-02-04'), { year: 2024, month: 2, day: 4 });
  assert.deepEqual(parseDate('1900-01-01'), { year: 1900, month: 1, day: 1 });
  assert.deepEqual(parseDate('2100-12-31'), { year: 2100, month: 12, day: 31 });

  // 闰日：2000 是闰年；1900 与 2100 不是（整百年要能被 400 整除）；2023-02-29 本来就不存在。
  assert.deepEqual(parseDate('2000-02-29'), { year: 2000, month: 2, day: 29 });

  const rejected = [
    '2024-2-4', // 月日必须两位
    '2024/02/04',
    '2024-02-30',
    '2023-02-29',
    '1900-02-29',
    '2100-02-29',
    '2023-04-31',
    '1899-12-31',
    '2101-01-01',
    '2024-13-01',
    '2024-00-10',
    '2024-01-00',
    '',
    '不是日期',
  ];
  for (const text of rejected) assert.throws(() => parseDate(text), Error, `${text} 不该被接受`);

  // 错误信息是中文，能直接展示给用户。
  for (const text of ['2024-02-30', '2024-13-01', '2024-2-4']) {
    const message = (() => {
      try {
        parseDate(text);
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    })();
    assert.ok(message.length > 0, `${text} 应有错误信息`);
    assert.equal(/[一-鿿]/.test(message), true, `${text} 的错误信息要用中文`);
  }
});

test('beijingToday 按 UTC+8 读日期，跨日边界不随本机时区变化', () => {
  // 2024-02-04T15:59:59Z → 北京时间 2024-02-04 23:59:59，还是 4 号。
  assert.equal(beijingToday(new Date('2024-02-04T15:59:59Z')), '2024-02-04');
  // 一秒后北京时间进入 2 月 5 日 00:00:00。
  assert.equal(beijingToday(new Date('2024-02-04T16:00:00Z')), '2024-02-05');
  // 同一时刻在 UTC 与纽约时区读出来必须是同一个北京日期。
  assert.equal(beijingToday(new Date('2024-02-04T16:00:00Z')), '2024-02-05');
  // 月末进位。
  assert.equal(beijingToday(new Date('2024-02-29T16:00:00Z')), '2024-03-01');
  assert.equal(beijingToday(new Date('2023-12-31T16:00:00Z')), '2024-01-01');
  // 年号也照常进位到百年边界之外仍然合法。
  assert.equal(beijingToday(new Date('2100-12-31T16:00:00Z')), '2101-01-01');
});

test('2024 立春 16:27:07：16:26 与 16:28 分属不同年柱与月柱', () => {
  const before = buildChart('2024-02-04', '16:26');
  const after = buildChart('2024-02-04', '16:28');

  assert.deepEqual(
    before.pillars.map((pillar) => pillar.values),
    [['癸卯'], ['乙丑'], ['戊戌'], ['庚申']],
    '16:26 还在癸卯年、乙丑月',
  );
  assert.deepEqual(
    after.pillars.map((pillar) => pillar.values),
    [['甲辰'], ['丙寅'], ['戊戌'], ['庚申']],
    '16:28 已经换成甲辰年、丙寅月',
  );
  assert.equal(before.warnings.length, 0, '落在节气同一侧的分钟不该有跨节气警告');
  assert.equal(after.warnings.length, 0);
});

test('立春正好落在某一分钟内：该分钟并列两值并给出警告', () => {
  // 16:27:07 就在 16:27 这一分钟里，起止两点分属立春两侧，所以只填到分钟时无法定这一柱。
  const inside = buildChart('2024-02-04', '16:27');
  assert.deepEqual(
    inside.pillars.map((pillar) => pillar.values),
    [['癸卯', '甲辰'], ['乙丑', '丙寅'], ['戊戌'], ['庚申']],
  );
  assert.deepEqual(inside.warnings, ['时间范围跨节气，相关柱未定']);

  // 节气不在这一分钟里时，年柱月柱是单值。
  assert.deepEqual(buildChart('2024-02-04', '16:26').pillars[0]!.values, ['癸卯']);
  assert.deepEqual(buildChart('2024-02-04', '16:28').pillars[0]!.values, ['甲辰']);
});

test('只有「节」换月柱，「气」不换：小满当天月柱不因为气而变动', () => {
  // 2024-05-20 20:59:31 是小满（气）。前后分钟月柱仍是己巳，只有时辰在换。
  assert.deepEqual(buildChart('2024-05-20', '20:58').pillars[1]!.values, ['己巳']);
  assert.deepEqual(buildChart('2024-05-20', '20:59').pillars[1]!.values, ['己巳']);
  assert.deepEqual(buildChart('2024-05-20', '21:00').pillars[1]!.values, ['己巳']);
  // 立夏（节）才换月柱：2024-05-05 08:10:05 两侧，日柱不变而月柱由戊辰换到己巳。
  assert.deepEqual(pillarsOf('2024-05-05', '08:09'), ['甲辰', '戊辰', '己巳', '戊辰']);
  assert.deepEqual(pillarsOf('2024-05-05', '08:11'), ['甲辰', '己巳', '己巳', '戊辰']);
  // 交接那一分钟（08:10:05 落在 08:10 里）月柱并列两值，日柱始终不动。
  assert.deepEqual(pillarsOf('2024-05-05', '08:10'), ['甲辰', '戊辰 | 己巳', '己巳', '戊辰']);
});

test('时辰未知：立春当天的年柱与月柱并列两值并给出警告', () => {
  const chart = buildChart('2024-02-04', null);

  assert.deepEqual(
    chart.pillars.map((pillar) => pillar.values),
    [
      ['癸卯', '甲辰'],
      ['乙丑', '丙寅'],
      ['戊戌'],
      [], // 时柱未定
    ],
  );
  assert.deepEqual(
    chart.pillars.map((pillar) => pillar.wuxing),
    [['水木', '木土'], ['木土', '火木'], ['土土'], []],
    '五行跟着每一柱的取值走，顺序一一对应',
  );
  assert.equal(chart.pillars[3]!.label, '时柱');
  assert.deepEqual(chart.pillars[3]!.values, [], '时柱必须留空，不用默认时刻顶替');
  assert.ok(
    chart.warnings.includes('时间范围跨节气，相关柱未定'),
    `警告里要说明跨节气，实际：${JSON.stringify(chart.warnings)}`,
  );
  assert.ok(chart.warnings.some((warning) => warning.includes('时柱未定')));
});

test('时辰未知：普通一天年/月/日柱确定，只有时柱留空', () => {
  const chart = buildChart('2024-05-20', null);

  assert.deepEqual(
    chart.pillars.map((pillar) => pillar.values),
    [['甲辰'], ['己巳'], ['甲申'], []],
    '普通一天只有时柱未定',
  );
  assert.deepEqual(chart.warnings, ['出生时辰未知，时柱未定，没有用默认时刻代替。']);
  // 时辰未知时，年/月/日柱都不该因为跨节气而并列。
  assert.equal(
    chart.pillars.slice(0, 3).every((pillar) => pillar.values.length === 1),
    true,
  );
});

test('已知时辰的普通一天：四柱齐全，时柱由时辰推出', () => {
  assert.deepEqual(pillarsOf('2024-05-20', '12:00'), ['甲辰', '己巳', '甲申', '庚午']);
  assert.deepEqual(pillarsOf('2024-05-20', '00:30'), ['甲辰', '己巳', '甲申', '甲子']);
  assert.equal(buildChart('2024-05-20', '12:00').warnings.length, 0);
  assert.deepEqual(labelsOf('2024-05-20', '12:00'), ['年柱', '月柱', '日柱', '时柱']);
});

test('晚子时按流派 2：日柱仍算当天，时柱按库的算法给出', () => {
  // 2024-02-09 23:00 已过立春，年柱是甲辰；流派 2 的日柱还是 2 月 9 日的癸卯。
  assert.deepEqual(pillarsOf('2024-02-09', '23:00'), ['甲辰', '丙寅', '癸卯', '甲子']);
  // 跨过零点后日柱换成甲辰，同一时辰的时柱不变。
  assert.deepEqual(pillarsOf('2024-02-10', '00:30'), ['甲辰', '丙寅', '甲辰', '甲子']);
  // 除夕当天 22:59 与 23:00 分属两个时辰，日柱按流派 2 保持同一天。
  assert.deepEqual(pillarsOf('2024-02-09', '22:59')[2], '癸卯');
  assert.deepEqual(pillarsOf('2024-02-09', '23:00')[2], '癸卯');
  assert.deepEqual(pillarsOf('2024-02-09', '23:59')[3], '甲子');
});

test('buildChart 拒绝不合法的日期与时刻', () => {
  assert.throws(() => buildChart('2023-02-30', null), Error);
  assert.throws(() => buildChart('2101-01-01', '12:00'), Error);
  assert.throws(() => buildChart('', null), Error);
  // 时刻必须是 HH:MM，且落在 00:00—23:59。
  for (const text of ['9:30', '09:5', '24:00', '12:60', '12', '中午', '12:00:00', ''])
    assert.throws(() => buildChart('2024-02-04', text), Error, `${text} 不该被接受`);
  // 日期合法、时刻合法时不该抛错。
  assert.doesNotThrow(() => buildChart('2024-02-04', '23:59'));
});

test('describeDay 给出目标日期的农历与前后节气', () => {
  const termDay = describeDay('2024-02-04');
  assert.equal(termDay.lunar, '二〇二三年腊月廿五');
  assert.equal(termDay.solarTerm, '立春 2024-02-04 16:27:07', '当天交接的节气带完整时刻');
  assert.equal(termDay.previousTerm, '立春 2024-02-04 16:27:07', '当天就是节气日，前一个是它自己');
  assert.equal(termDay.nextTerm, '雨水 2024-02-19 12:13:12');

  // 前一天与后一天看的是同一次交接，前后各落在两侧。
  assert.equal(describeDay('2024-02-03').previousTerm, '大寒 2024-01-20 22:07:22');
  assert.equal(describeDay('2024-02-03').nextTerm, '立春 2024-02-04 16:27:07');

  const plainDay = describeDay('2024-02-05');
  assert.equal(plainDay.solarTerm, '', '当天没有节气交接时留空');
  assert.equal(plainDay.previousTerm, '立春 2024-02-04 16:27:07');
  assert.equal(plainDay.nextTerm, '雨水 2024-02-19 12:13:12');

  // 跨年也要能取到上一个节气。
  assert.equal(describeDay('2024-01-01').previousTerm, '冬至 2023-12-22 11:27:20');
  assert.equal(describeDay('2024-01-01').nextTerm, '小寒 2024-01-06 04:49:22');
  assert.throws(() => describeDay('2024-02-30'), Error);
});

test('同一个人同一天的小签稳定，换目标日期会重新选', () => {
  const first = dailySign('阿蘅', '1994-08-16', null, '2024-02-04');
  assert.deepEqual(
    dailySign('阿蘅', '1994-08-16', null, '2024-02-04'),
    first,
    '同样的输入必须同一支签',
  );
  assert.equal(first.title, '先稳后行');

  // 姓名规范化：只差外围空白与全角/半角空格时，得到同一支签。
  assert.deepEqual(dailySign('  阿蘅  ', '1994-08-16', null, '2024-02-04'), first);
  const spaced = dailySign('阿　蘅', '1994-08-16', null, '2024-02-04');
  assert.deepEqual(spaced, dailySign('阿 蘅', '1994-08-16', null, '2024-02-04'));
  assert.equal(spaced.name, '阿 蘅');

  // 换目标日期会重新选签，并且每一次都可复现。
  const targets = ['2024-02-05', '2024-02-06', '2024-03-01', '2025-01-01'];
  const titles = new Set<string>();
  const signs = [first];
  for (const target of targets) {
    const sign = dailySign('阿蘅', '1994-08-16', null, target);
    assert.deepEqual(dailySign('阿蘅', '1994-08-16', null, target), sign);
    titles.add(sign.title);
    signs.push(sign);
  }
  assert.ok(titles.size > 1, '不同目标日期应该抽到过不同的签');

  // 签文只给日常建议，不出现疾病/财富之类的承诺。
  for (const sign of signs) {
    const text = `${sign.title}${sign.message}${sign.try}${sign.avoid}`;
    assert.equal(/准确率|灵验|疾病|发财|财运|注定|寿命/.test(text), false, text);
  }
});

test('小签的姓名做长度与空白校验', () => {
  assert.throws(() => dailySign('', '1994-08-16', null, '2024-02-04'), Error);
  assert.throws(() => dailySign('   ', '1994-08-16', null, '2024-02-04'), Error);
  assert.throws(() => dailySign('　　', '1994-08-16', null, '2024-02-04'), Error);
  assert.throws(() => dailySign('甲'.repeat(41), '1994-08-16', null, '2024-02-04'), Error);
  // 40 个码点是上限，正好 40 个要能通过。
  assert.equal(dailySign('甲'.repeat(40), '1994-08-16', null, '2024-02-04').name.length, 40);
  // 错误信息是中文。
  try {
    dailySign('', '1994-08-16', null, '2024-02-04');
    assert.fail('空名字应当抛错');
  } catch (error) {
    assert.equal(/[一-鿿]/.test((error as Error).message), true);
  }
});

test('姓名只影响娱乐签，不改变任何一柱', () => {
  const a = pillarsOf('1994-08-16', null);
  const b = pillarsOf('1994-08-16', null);
  assert.deepEqual(a, b);
  // 同一个生日，两份不同名字的签卡：四柱完全不受影响。
  const signA = dailySign('阿蘅', '1994-08-16', null, '2024-02-04');
  const signB = dailySign('另一个人', '1994-08-16', null, '2024-02-04');
  assert.notEqual(`${signA.title}${signA.name}`, `${signB.title}${signB.name}`);
  assert.deepEqual(pillarsOf('1994-08-16', null), a);
});
