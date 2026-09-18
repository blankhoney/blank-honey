/* 读入一份 Markdown 文件时的纯函数：名字、扩展名、大小、编码。这里不碰 DOM、不读文件——
 * File 对象由 main.ts 拿到后把 ArrayBuffer 交给 decodeMarkdown。 */

/** 单份文件的大小上限。Markdown 是纯文本，2 MiB 已远超一篇文章的体量。 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** 可以打开的文件扩展名，文件选择与拖入共用。 */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

/** 显示用的文件名：去掉目录成分，空名字回落到占位。 */
export function displayName(name: string): string {
  const base = name.replaceAll('\\', '/').split('/').pop() ?? '';
  const trimmed = base.trim();
  return trimmed === '' ? '未命名文件' : trimmed;
}

/** 扩展名是否在可打开列表里，大小写不敏感。 */
export function isMarkdownFileName(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return MARKDOWN_EXTENSIONS.includes(name.slice(dot).toLowerCase());
}

/** 字节数是否在上限之内。非安全整数（含 NaN/Infinity）一律不接受。 */
export function isWithinSizeLimit(bytes: number): boolean {
  return Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= MAX_FILE_BYTES;
}

/** 严格 UTF-8 解码：非法字节抛错而不替换，开头 BOM 去掉（否则会以零宽字符留在第一行）。 */
export function decodeMarkdown(bytes: ArrayBuffer): string {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
