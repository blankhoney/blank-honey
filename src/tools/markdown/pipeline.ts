/* Markdown 渲染流水线：markdown-it 解析 → 受控渲染 → DOMPurify 白名单净化。
 *
 * 安全边界有三层，各自独立成立，不依赖另一层正确：
 * 1. markdown-it 关闭原始 HTML（html:false），文件里的标签只会作为文字出现；
 * 2. 渲染器自己接管图片、表格对齐、任务列表、代码块，不产出 <img>、<script> 或内联 style；
 * 3. 链接协议在 markdown-it 侧先过滤一次，最终 HTML 再交给 DOMPurify 按白名单过滤一次。
 *
 * renderMarkdown() 不碰 DOM，可以在纯 Node 下测试；只有 DOMPurify 需要浏览器 DOM，
 * 所以 sanitizeHtml() 在没有 DOM 时抛出明确错误，而不是静默地把未净化的 HTML 交出去。
 */

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import type { Renderer, Token } from 'markdown-it';

/* 这个版本的 @types/markdown-it 没有把 Options 作为具名导出（MarkdownIt 是值不是类型），
 * 所以从 Renderer 的方法签名里取，避免手写一份会漂移的副本。 */
type RenderOptions = Parameters<Renderer['renderInlineAsText']>[1];
type RenderEnv = Record<string, unknown> | undefined;

/** 允许的链接协议，其余带协议的地址一律丢弃。 */
const SAFE_LINK_SCHEME = /^(?:https?|mailto|tel)$/i;

/** 判断协议前先去掉的字符：空白与控制字符可以把 "java\nscript:" 藏起来。 */
const LINK_NOISE = /[\s\u0000-\u001f\u007f-\u009f]/g;

/** 代码块语言标签：只接受短标识符。 */
const LANGUAGE_LABEL = /^[A-Za-z0-9+#._-]{1,24}$/;

/** 表格对齐由 markdown-it 写成行内 style，这里读出来改成类名。 */
const CELL_ALIGN = /text-align:\s*(left|center|right)/i;

/** DOMPurify 放行属性值时用的地址白名单。形状与其默认值一致，协议收窄到 http/https/mailto/tel；
 * 保留后两段是因为属性值里还有相对地址、锚点和 class="task-item" 这类普通文本。 */
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

/** 渲染结果里允许出现的标签：markdown-it 常规输出 + 本工具自己的容器与占位元素。 */
const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'caption',
  'code',
  'del',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

/** 会执行脚本、发起请求或接受交互的标签；同样不在 ALLOWED_TAGS 里，写出来是为了边界可审查。 */
const FORBID_TAGS = [
  'applet',
  'audio',
  'base',
  'button',
  'canvas',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'img',
  'input',
  'link',
  'math',
  'meta',
  'noscript',
  'object',
  'picture',
  'script',
  'select',
  'source',
  'style',
  'svg',
  'template',
  'textarea',
  'video',
];

/** 不含 id/name（无处做 DOM clobbering）、不含 style、不含 src/srcset（图片没有加载入口）。 */
const ALLOWED_ATTR = [
  'aria-hidden',
  'aria-label',
  'class',
  'href',
  'referrerpolicy',
  'rel',
  'target',
  'title',
];

/** 与属性名无关的取值入口，一并封掉。 */
const FORBID_ATTR = [
  'action',
  'background',
  'data',
  'dynsrc',
  'formaction',
  'lowsrc',
  'ping',
  'poster',
  'src',
  'srcdoc',
  'srcset',
  'style',
  'xlink:href',
];

/** 只放行 http/https/mailto/tel 与不带协议的相对地址、锚点；判断前去掉空白与控制字符。 */
export function isSafeLink(url: string): boolean {
  const value = url.replace(LINK_NOISE, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return scheme === null || SAFE_LINK_SCHEME.test(scheme[1]);
}

/** 图片占位块：图片永不加载，src 只作为文字出现在说明里。 */
function imagePlaceholder(
  tokens: Token[],
  idx: number,
  options: RenderOptions,
  env: RenderEnv,
  self: Renderer,
): string {
  const token = tokens[idx];
  const alt = self.renderInlineAsText(token.children ?? [], options, env).trim();
  const title = String(token.attrGet('title') ?? '').trim();
  const address = String(token.attrGet('src') ?? '').trim();

  const altLine = alt === '' ? '' : `<span class="markdown-figure-alt">${escapeText(alt)}</span>`;
  const titleLine =
    title === '' ? '' : `<span class="markdown-figure-title">「${escapeText(title)}」</span>`;
  const addressLine =
    address === '' ? '没有写下地址。' : `图片来源：${escapeText(address)}（不会自动加载）`;

  return [
    '<figure class="markdown-figure">',
    '<span class="markdown-figure-badge" aria-hidden="true">图</span>',
    '<figcaption class="markdown-figure-note">',
    altLine,
    titleLine,
    `<span class="markdown-figure-path">${addressLine}</span>`,
    '<span class="markdown-figure-hint">图片不会被自动加载，这里只留下它的位置和地址。</span>',
    '</figcaption>',
    '</figure>',
  ].join('');
}

/** 转义标签之间的文字。 */
function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** 代码块外壳：局部横向滚动，带一个可选的语言标签。 */
function codeBlock(language: string, code: string): string {
  const label = LANGUAGE_LABEL.test(language)
    ? `<span class="markdown-code-lang" aria-hidden="true">${escapeText(language)}</span>`
    : '';
  return `<div class="markdown-code">${label}<pre><code>${code}</code></pre></div>`;
}

/** 把 markdown-it 写在单元格上的对齐方式换成类名，同时丢掉行内 style。 */
function cellOpen(
  tokens: Token[],
  idx: number,
  options: RenderOptions,
  _env: RenderEnv,
  self: Renderer,
): string {
  const token = tokens[idx];
  const align = CELL_ALIGN.exec(String(token.attrGet('style') ?? ''))?.[1]?.toLowerCase();
  if (align !== undefined) token.attrJoin('class', `col-${align}`);
  token.attrs = (token.attrs ?? []).filter(([name]) => name.toLowerCase() !== 'style');
  return self.renderToken(tokens, idx, options);
}

/** 建好一个配置完成的解析器：渲染规则与安全策略都在这里定下。 */
function createMarkdown(): InstanceType<typeof MarkdownIt> {
  const markdown = new MarkdownIt({
    html: false, // 原始 HTML 一律当文字，净化是第二道而不是唯一一道
    linkify: false, // 不把裸网址变成链接，链接只来自文件里写下的语法
    typographer: false, // 不改写引号破折号：渲染与原文尽量对得上
    breaks: false,
    xhtmlOut: false,
  });

  markdown.validateLink = (url: string): boolean => isSafeLink(url);

  const rules = markdown.renderer.rules;

  rules.image = imagePlaceholder;

  // 即使将来有人打开 html 选项，这两个规则也不会把原始 HTML 放出去。
  rules.html_block = () => '';
  rules.html_inline = () => '';

  // 链接一律外开：target/rel 管点击行为，referrerpolicy 保证不发送来源。
  rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
    token.attrSet('referrerpolicy', 'no-referrer');
    return self.renderToken(tokens, idx, options);
  };

  // 两种代码块统一包一层，代码文本按原文转义；语言名只取信息串的第一个词。
  rules.fence = (tokens, idx) => {
    const language = tokens[idx].info.trim().split(/\s+/)[0] ?? '';
    return codeBlock(language, escapeText(tokens[idx].content));
  };
  rules.code_block = (tokens, idx) => codeBlock('', escapeText(tokens[idx].content));

  // 长表格外面套一层局部横向滚动容器，避免把手机撑破。
  rules.table_open = () => '<div class="markdown-table-wrap"><table>';
  rules.table_close = () => '</table></div>';

  rules.th_open = cellOpen;
  rules.td_open = cellOpen;

  // 任务列表项：只加不可交互的方框标记，勾选状态由读屏文字补充。
  rules.list_item_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const task = (token.meta as { taskItem?: boolean } | null)?.taskItem;
    if (task !== true) return self.renderToken(tokens, idx, options);
    const done = String(token.attrGet('data-task') ?? '') === 'done';
    token.attrJoin('class', 'task-item');
    token.attrs = (token.attrs ?? []).filter(([name]) => name.toLowerCase() !== 'data-task');
    return [
      self.renderToken(tokens, idx, options),
      `<span class="task-check" aria-hidden="true">${done ? '☒' : '☐'}</span>`,
      `<span class="visually-hidden">${done ? '已完成：' : '未完成：'}</span>`,
      ' ',
    ].join('');
  };

  // 任务标记只在解析阶段认一次：项目第一段开头必须是 "[ ] " 或 "[x] "。
  // 撞到下一个 list_item_open（嵌套列表）或 list_item_close 都说明这一项不是任务项。
  markdown.core.ruler.push('task-list-items', (state) => {
    const tokens = state.tokens;
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index].type !== 'list_item_open') continue;
      for (let next = index + 1; next < tokens.length; next += 1) {
        const token = tokens[next];
        if (token.type === 'list_item_close' || token.type === 'list_item_open') break;
        if (token.type !== 'inline' || token.children === null) continue;
        const [first] = token.children;
        const match = first?.type === 'text' ? /^\[([ xX])\]\s+/.exec(first.content) : null;
        if (match === null) break;
        const done = match[1] !== ' ';
        tokens[index].meta = { taskItem: true };
        tokens[index].attrSet('data-task', done ? 'done' : 'open');
        first.content = first.content.slice(match[0].length);
        break;
      }
    }
  });

  return markdown;
}

const markdown = createMarkdown();

/** 把 Markdown 渲染成 HTML（尚未净化）。不碰 DOM；净化由 sanitizeHtml() 负责。 */
export function renderMarkdown(source: string): string {
  return markdown.render(source, {});
}

/** 按白名单净化一段 HTML。没有 DOM（例如纯 Node）时直接抛错，绝不返回未净化的结果。 */
export function sanitizeHtml(html: string): string {
  if (!DOMPurify.isSupported) throw new Error('当前环境没有 DOM，无法净化渲染结果。');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    // 只认 HTML 命名空间：SVG/MathML 里那些能带脚本的标签连解析机会都没有。
    ALLOWED_NAMESPACES: ['http://www.w3.org/1999/xhtml'],
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });
}

/** 渲染并净化：页面唯一可以写进 DOM 的结果。 */
export function markdownToHtml(source: string): string {
  return sanitizeHtml(renderMarkdown(source));
}
