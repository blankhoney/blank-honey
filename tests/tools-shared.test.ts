import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatBytes } from '../src/tools/shared/ui';

/* ui.ts 里还有 downloadBlob 和 safeDownloadName。这两个都要 DOM/URL，
 * 只读任务不在这里造假 DOM，改在下面用源码与 CSS 契约做静态核对：
 * 共享 API 只有两个具名导出、样式不影响主站。 */

test('formatBytes 按 1024 进制给出人类可读的字节数', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1), '1 B');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(1023), '1023 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1024 ** 2), '1 MB');
  assert.equal(formatBytes(1024 ** 2 * 2.25), '2.3 MB');
  assert.equal(formatBytes(1024 ** 3), '1 GB');
  assert.equal(formatBytes(1024 ** 4), '1 TB');
  assert.equal(formatBytes(1024 ** 5), '1 PB');
});

test('formatBytes 不会显示 1024 这类跨单位数字，也不对负数与非法输入抛错', () => {
  // 1023.9 KB 原样显示；再往上就会进位成 MB，绝不会出现 "1024 KB"。
  assert.equal(formatBytes(1024 * 1023.9), '1023.9 KB');
  assert.equal(formatBytes(1024 * 1023.96), '1 MB');
  assert.equal(formatBytes(1024 * 1024 - 1), '1 MB');

  for (const value of [-1, -1024, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
    assert.equal(formatBytes(value), '0 B', `${value} 应按 0 处理`);

  // 属性检查：不是最大单位时，数字必须小于 1024；单位永远是最小到最大的一档。
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  for (let exponent = 0; exponent <= 8; exponent += 0.25) {
    const text = formatBytes(1024 ** exponent);
    const [number = '', unit = ''] = text.split(' ');
    assert.equal(units.includes(unit), true, `${text} 的单位不在列表里`);
    const numeric = Number(number);
    assert.equal(Number.isFinite(numeric), true, `${text} 的数字部分无法解析`);
    if (unit !== 'PB') assert.ok(numeric < 1024, `${text} 应进位到更大的单位`);
    assert.ok(numeric > 0, `${text} 应大于 0`);
  }
  // 超出 PB 的极大值停在 PB，不会出现 undefined 单位。
  assert.equal(formatBytes(1024 ** 8), `${Math.round(1024 ** 3)} PB`);
  assert.equal(formatBytes(1024 ** 8).includes('undefined'), false);
});

test('formatBytes 最多一位小数，整数不带小数点', () => {
  for (const value of [0, 1024, 1024 ** 2, 3 * 1024, 1024 ** 3 * 4, 1536, 1024 ** 2 * 2.25]) {
    const [number = '', unit = ''] = formatBytes(value).split(' ');
    assert.equal(/^\d+(\.\d)?$/.test(number), true, `${value} -> ${formatBytes(value)}`);
    assert.equal(/^(B|KB|MB|GB|TB|PB)$/.test(unit), true, `${value} -> ${formatBytes(value)}`);
  }
});

test('共享样式只作用于带 data-tool 的工具页，不碰主站', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/tools/shared/style.css', import.meta.url), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // 逐条选择器核对：除了 :root 变量、@ 规则和 @keyframes 的百分比帧，
  // 每条都要以 body[data-tool] 开头，主站元素不会被命中。
  let checked = 0;
  let insideKeyframes = false;
  for (const match of bare.matchAll(/([^{}]*)\{/g)) {
    const prelude = match[1]!.trim().replace(/\s+/g, ' ');
    if (prelude === '') continue;
    if (prelude.startsWith('@keyframes')) {
      insideKeyframes = true;
      continue;
    }
    if (prelude.startsWith('@')) continue;
    if (prelude === ':root' || insideKeyframes) continue;
    for (const selector of prelude.split(',')) {
      checked += 1;
      const text = selector.trim();
      // body[data-tool] 本身，以及带具体工具的 body[data-tool='<slug>'] 都算限定。
      assert.equal(
        text.startsWith('body[data-tool]') || text.startsWith("body[data-tool='"),
        true,
        `选择器没有限定在工具页内：${text}`,
      );
    }
  }
  const closed = (bare.match(/\}/g) ?? []).length;
  assert.ok(checked > 50, `应核到足够多的选择器，实际 ${checked}（共 ${closed} 个块）`);
  // 括号必须配平，避免漏掉未闭合的规则。
  assert.equal((bare.match(/\{/g) ?? []).length, closed);

  // 不引用远程资源，也不把别人的样式拉进来。
  assert.equal(/@import|https?:\/\/|\/\/fonts/.test(bare), false, '共享样式不得引用远程资源');
  // 暗色、窄屏、减少动效都有对应分支。
  assert.equal(bare.includes('prefers-color-scheme: dark'), true);
  assert.equal(bare.includes('max-width: 560px'), true);
  assert.equal(bare.includes('prefers-reduced-motion: reduce'), true);
  // 每款工具的页面都能拿到自己的点缀色。
  for (const slug of ['archive', 'image-crop', 'markdown', 'luck', 'fortune'])
    assert.equal(bare.includes(`body[data-tool='${slug}']`), true, `缺少 ${slug} 的点缀色`);
  // hidden 属性必须让元素真的不显示：共享样式给 .field 设了 display:flex，
  // 会盖掉浏览器默认的 [hidden] 规则，别的工具页也会踩到。
  assert.equal(/\[hidden\]\s*\{[^}]*display:\s*none/.test(bare), true);
});

test('README 约定的公共类名都有样式，其他工具可直接使用', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const css = await readFile(new URL('../src/tools/shared/style.css', import.meta.url), 'utf8');
  const readme = await readFile(
    fileURLToPath(new URL('../src/tools/README.md', import.meta.url)),
    'utf8',
  );
  const line = readme.split('\n').find((text) => text.includes('`tool-shell`'));
  assert.ok(line, 'README 应列出共享类名');
  const names = [...line.matchAll(/`([a-z][a-z0-9-]*(?:--[a-z0-9-]+)?)`/g)].map(
    (match) => match[1]!,
  );
  assert.ok(names.length >= 20, `README 里的类名太少：${names.length}`);
  for (const name of names) assert.equal(css.includes(`.${name}`), true, `共享样式缺少 .${name}`);
});

test('工具页样式不修改主站加载的样式表', async () => {
  const { readFile } = await import('node:fs/promises');
  // 工具页的 CSS 只被 src/tools 下的入口导入；主站入口不应引用它们。
  const siteCss = await readFile(new URL('../src/styles/site.css', import.meta.url), 'utf8');
  for (const token of ['--paper-2', 'tool-shell', 'luck-stage', 'data-tool'])
    assert.equal(siteCss.includes(token), false, `主站样式不应包含工具页记号：${token}`);
});

test('共享模块只导出约定的两个 API', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/tools/shared/ui.ts', import.meta.url), 'utf8');
  const exported = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(exported.sort(), ['downloadBlob', 'formatBytes']);
});

test('下载在释放 ObjectURL 前留出时间，避免 Safari 拿到失效地址', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/tools/shared/ui.ts', import.meta.url), 'utf8');
  // 延迟释放：不能让 createObjectURL 和 revokeObjectURL 挨着执行。
  assert.equal(
    /createObjectURL[\s\S]{0,400}?setTimeout\([\s\S]{0,200}?revokeObjectURL/.test(source),
    true,
  );
  assert.equal(/createObjectURL\([^)]*\);\s*URL\.revokeObjectURL/.test(source), false);
  // 文件名经过整理；不写日志、不动 localStorage、不拼 URL。
  assert.equal(source.includes('safeDownloadName(filename)'), true);
  for (const banned of ['console.', 'localStorage', 'sessionStorage', 'Math.random'])
    assert.equal(source.includes(banned), false, `共享模块不应使用 ${banned}`);
});
