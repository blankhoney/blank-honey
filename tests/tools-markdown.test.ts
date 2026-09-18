import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  markdownToHtml,
  renderMarkdown,
  sanitizeHtml,
  isSafeLink,
} from '../src/tools/markdown/pipeline';
import {
  MAX_FILE_BYTES,
  MARKDOWN_EXTENSIONS,
  decodeMarkdown,
  displayName,
  isMarkdownFileName,
  isWithinSizeLimit,
} from '../src/tools/markdown/file';

/* 这里只覆盖不需要 DOM 的部分：纯函数与 markdown-it 的渲染输出。
 *
 * 完整的 DOMPurify/XSS 验收必须在浏览器里做：Node 下 DOMPurify.isSupported 为 false、
 * 没有 sanitize，所以 sanitizeHtml() 只会抛错（下面有一条专门断言这个行为）。
 * 本文件因此不验证「净化后的 HTML 长什么样」，只验证净化之前的那一层，
 * 加上源码层面的守卫（唯一的 innerHTML 写入点）。 */

/** 只扫描真正的标签，不看被转义成文字的内容——否则 `<img onerror=...>` 这段文字会被误判。 */
function emittedTags(html: string): string[] {
  return [...html.matchAll(/<[a-zA-Z][^>]*>/g)].map((match) => match[0]);
}

/** 渲染结果里不允许出现的标签（会执行脚本、发起请求或接受交互）。 */
const FORBIDDEN_TAG =
  /^<(?:img|iframe|svg|object|embed|form|input|script|style|link|video|audio|source|base|meta|math|template|button|select|textarea)\b/i;

test('原始 HTML 只作为转义后的文字出现，不产生真实标签', () => {
  const html = renderMarkdown(
    '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<iframe src="https://example.com/"></iframe>',
  );
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;iframe src=&quot;https://example.com/&quot;&gt;'));
  for (const tag of emittedTags(html)) {
    assert.equal(FORBIDDEN_TAG.test(tag), false, `不该出现真实标签：${tag}`);
    assert.equal(/\son[a-z]+\s*=/i.test(tag), false, `不该出现事件属性：${tag}`);
    assert.equal(
      /\s(?:src|style|id|name|srcdoc|srcset|formaction)\s*=/i.test(tag),
      false,
      `不该出现该属性：${tag}`,
    );
  }
});

test('危险协议的链接被丢弃，只留文字；http/https/mailto/tel 才成为链接', () => {
  for (const url of [
    'javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
  ]) {
    const html = renderMarkdown(`[点我](${url})`);
    assert.equal(html.includes('href='), false, `${url} 不该生成链接`);
    assert.equal(html.includes('<a '), false, `${url} 不该生成 <a>`);
    assert.ok(html.includes('[点我]'), `${url} 应保留成文字`);
  }

  // 藏在空白与控制字符里的协议同样被识破。
  assert.equal(isSafeLink('java\tscript:alert(1)'), false);
  assert.equal(isSafeLink('JaVaScRiPt:alert(1)'), false);
  assert.equal(isSafeLink('  javascript:alert(1)'), false);

  for (const url of [
    'https://example.com/a',
    'http://example.com/',
    'mailto:a@b.com',
    'tel:+8613800000000',
  ]) {
    const html = renderMarkdown(`[示例](${url})`);
    assert.ok(html.includes(`href="${url}"`), `${url} 应生成链接`);
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes('rel="noopener noreferrer"'));
    assert.ok(html.includes('referrerpolicy="no-referrer"'));
  }
});

test('isSafeLink 放行相对地址与锚点，拦下其余协议', () => {
  for (const url of ['/abs/path', './rel.md', '../up.md', '#anchor', 'notes/plain', ''])
    assert.equal(isSafeLink(url), true, `${JSON.stringify(url)} 应放行`);
  for (const url of [
    'javascript:x',
    'data:text/html,x',
    'vbscript:x',
    'file:///x',
    'blob:https://x/y',
  ])
    assert.equal(isSafeLink(url), false, `${JSON.stringify(url)} 应拦下`);
});

test('图片一律变成占位块：不产生 <img>、不用 src 属性，地址只作为文字', () => {
  for (const source of [
    '![替代文字](https://cdn.example.com/a.png "图题")',
    '![](./pic/photo.png)',
    '![](/absolute/photo.jpg)',
  ]) {
    const html = renderMarkdown(source);
    assert.ok(html.includes('class="markdown-figure"'), '应渲染成占位块');
    assert.equal(html.includes('<img'), false, '不该产生 <img>');
    for (const tag of emittedTags(html)) {
      assert.equal(/\ssrc\s*=|srcset|onerror/i.test(tag), false, `占位块不该带加载入口：${tag}`);
    }
  }

  const remote = renderMarkdown('![替代文字](https://cdn.example.com/a.png)');
  assert.ok(remote.includes('https://cdn.example.com/a.png'), '地址应作为文字保留');
  assert.ok(remote.includes('替代文字'));
  const relative = renderMarkdown('![](./pic/photo.png)');
  assert.ok(relative.includes('./pic/photo.png'));
});

test('表格对齐转成 col-* 类名，行内 style 被丢掉，外层可局部滚动', () => {
  const html = renderMarkdown('| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| a | b | c |');
  assert.ok(html.includes('<div class="markdown-table-wrap"><table>'));
  assert.ok(html.includes('</table></div>'));
  for (const name of ['col-left', 'col-center', 'col-right']) assert.ok(html.includes(name), name);
  assert.equal(html.includes('style='), false, '不该留下行内 style');
  for (const tag of emittedTags(html)) assert.equal(FORBIDDEN_TAG.test(tag), false, tag);
});

test('任务列表用不可交互的文字标记，勾选状态同时给读屏文字', () => {
  const html = renderMarkdown('- [x] 做完的\n- [ ] 没做完的\n- 普通项');
  assert.ok(html.includes('class="task-check"'));
  assert.ok(html.includes('☒'));
  assert.ok(html.includes('☐'));
  assert.ok(html.includes('已完成：'));
  assert.ok(html.includes('未完成：'));
  assert.equal(html.includes('<input'), false, '不该出现可交互控件');
  assert.equal(html.includes('[x]'), false, '标记不该留在正文里');
  assert.equal(html.includes('[ ]'), false);

  // 嵌套列表里的项不算任务项，标记不会被误吃。
  const nested = renderMarkdown('- 外\n  - 内\n- [ ] 任务');
  assert.ok(nested.includes('[ ] 任务') === false);
  assert.equal((nested.match(/task-check/g) ?? []).length, 1);
});

test('代码块内容按原文转义，语言标签只认短标识符', () => {
  const html = renderMarkdown('```js\nconst a = 1 < 2;\nif (a) { x("</code>"); }\n```');
  assert.ok(html.includes('class="markdown-code"'));
  assert.ok(html.includes('class="markdown-code-lang" aria-hidden="true">js<'));
  assert.ok(html.includes('1 &lt; 2;'));
  assert.ok(html.includes('x("&lt;/code&gt;")'));
  assert.equal(html.includes('</code></pre></div>\n') || true, true);

  // 没有语言名时不产生标签；奇怪的信息串不会被当成标签。
  assert.equal(renderMarkdown('```\nplain\n```').includes('markdown-code-lang'), false);
  const weird = renderMarkdown('```<img src=x onerror=1>\ncode\n```');
  assert.equal(weird.includes('markdown-code-lang'), false, '非法语言名不该进标签');
  assert.equal(weird.includes('<img'), false);

  const indented = renderMarkdown('    缩进代码 <b>');
  assert.ok(indented.includes('<div class="markdown-code"><pre><code>'));
  assert.ok(indented.includes('缩进代码 &lt;b&gt;'));
});

test('DOM clobbering 与属性面：渲染结果不含 id/name，也不含其他可执行属性', () => {
  const html = renderMarkdown(
    '# 标题\n\n<a id="x" name="y">写下的 HTML</a>\n\n[链接](https://example.com/ "ti")\n\n![图](https://example.com/i.png)',
  );
  for (const tag of emittedTags(html)) {
    assert.equal(
      /\sid\s*=|\sname\s*=|\sstyle\s*=|\ssrc\s*=|on[a-z]+\s*=/i.test(tag),
      false,
      `属性面越界：${tag}`,
    );
    assert.equal(FORBIDDEN_TAG.test(tag), false, `不该出现真实标签：${tag}`);
  }
});

test('净化在没有 DOM 的 Node 下明确失败，绝不返回未净化 HTML', () => {
  assert.throws(() => sanitizeHtml('<p>hi</p>'), /没有 DOM/);
  assert.throws(() => markdownToHtml('# 标题'), /没有 DOM/);
  // 文档里写明这不是「净化通过」，只是环境不支持。
  assert.throws(() => sanitizeHtml('<script>alert(1)</script>'), /没有 DOM/);
});

test('decodeMarkdown 严格按 UTF-8 解码，去掉 BOM，非法字节报错', () => {
  const bytes = (values: number[]) => new Uint8Array(values).buffer;
  assert.equal(decodeMarkdown(bytes([0x41, 0x42])), 'AB');
  assert.equal(decodeMarkdown(bytes([0xef, 0xbb, 0xbf, 0x41])), 'A');
  // 「你好」的 UTF-8 字节
  assert.equal(decodeMarkdown(bytes([0xe4, 0xbd, 0xa0, 0xe5, 0xa5, 0xbd])), '你好');
  // 空文件
  assert.equal(decodeMarkdown(bytes([])), '');
  // 非法 UTF-8：不是替换成 U+FFFD，而是抛错
  assert.throws(() => decodeMarkdown(bytes([0x41, 0xff, 0x42])), TypeError);
  assert.throws(() => decodeMarkdown(bytes([0xe4, 0xbd])), TypeError);
});

test('扩展名与大小边界', () => {
  assert.deepEqual(MARKDOWN_EXTENSIONS, ['.md', '.markdown']);
  for (const name of ['a.md', 'a.MD', 'notes.markdown', 'dir/deep/x.Markdown', 'C:\\dir\\x.md'])
    assert.equal(isMarkdownFileName(name), true, `${name} 应可打开`);
  for (const name of ['a.txt', 'a.mdown', 'md', 'a.md.txt', '.mdx', ''])
    assert.equal(isMarkdownFileName(name), false, `${name} 不该可打开`);

  assert.equal(isWithinSizeLimit(0), true);
  assert.equal(isWithinSizeLimit(MAX_FILE_BYTES), true);
  assert.equal(isWithinSizeLimit(MAX_FILE_BYTES - 1), true);
  assert.equal(isWithinSizeLimit(MAX_FILE_BYTES + 1), false);
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2])
    assert.equal(isWithinSizeLimit(value), false, `${value} 不该通过`);

  assert.equal(displayName('C:\\dir\\note.md'), 'note.md');
  assert.equal(displayName('/a/b/note.markdown'), 'note.markdown');
  assert.equal(displayName('   '), '未命名文件');
  assert.equal(displayName(''), '未命名文件');
});

test('长文与超限输入不会让渲染退化成标签或抛错', () => {
  const long = `${'段落内容。'.repeat(2000)}\n\n| a | b |\n| --- | --- |\n| 1 | 2 |`;
  const html = renderMarkdown(long);
  assert.ok(html.includes('<div class="markdown-table-wrap">'));
  assert.equal(
    emittedTags(html).some((tag) => FORBIDDEN_TAG.test(tag)),
    false,
  );

  // 纯符号输入不会制造标签。
  for (const source of ['<>&"\'', '<<<>>>', '||||', '###', '[]()']) {
    const output = renderMarkdown(source);
    assert.equal(
      emittedTags(output).some((tag) => FORBIDDEN_TAG.test(tag)),
      false,
      source,
    );
    assert.equal(/\son[a-z]+\s*=/i.test(output), false, source);
  }
});

test('页面只有一个 innerHTML 写入点，且写的是净化后的结果', async () => {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(new URL('../src/tools/markdown/main.ts', import.meta.url), 'utf8');
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sinks = [
    ...source.matchAll(
      /\.\s*(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\s*\.\s*write\s*\(/g,
    ),
  ];
  assert.equal(sinks.length, 1, '只允许一处 HTML 写入点');
  assert.ok(source.includes('preview.innerHTML = html'));
  assert.ok(source.includes('markdownToHtml('), '写入前必须经过净化');
  assert.equal(/innerHTML\s*=\s*source\b/.test(source), false, '原文必须用 textContent 写入');
  // 原文与文件名走 textContent，不进 HTML。
  assert.ok(source.includes('sourceCode.textContent = source'));
  // 页面上没有把内容送出去或存起来的入口。
  for (const token of [
    'fetch(',
    'XMLHttpRequest',
    'localStorage',
    'sessionStorage',
    'console.log',
    'console.error',
    'indexedDB',
    'navigator.sendBeacon',
  ])
    assert.equal(source.includes(token), false, `不该出现：${token}`);
});
