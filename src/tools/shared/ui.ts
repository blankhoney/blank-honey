/* 独立工具工作台共享工具函数。
 *
 * 对外契约（见 src/tools/README.md，不要擅自加公共 API）：
 *   downloadBlob(blob, filename) —— 触发一次本机下载
 *   formatBytes(bytes)           —— 人类可读的字节数
 * 文件名的整理是内部实现，别的工具页不需要知道。
 */

/** 触发下载后延迟释放 ObjectURL 的时间。
 *
 * 下载是异步开始的：Safari 会同步启动下载，但 Firefox/Chrome 会先派发点击再取数据。
 * 立即 revoke 会让 Safari 拿到已失效的 URL 而下载失败，所以等一小段时间再释放。
 */
const REVOKE_DELAY_MS = 60_000;

/** Windows 保留设备名，作为整段文件名时无法创建文件。 */
const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/** 文件名最大长度（按字符计），给扩展名和去重后缀留出余量。 */
const MAX_BASENAME = 80;

/** 回退文件名，极端输入下也不会得到空名字。 */
const FALLBACK_NAME = 'download';

// 斜杠在上一步拆路径时已处理。这里覆盖 Windows 非法字符与全部控制字符（含换行、制表）；
// 空格与连字符在文件名里合法，保留。文件名按原样交给浏览器，不写日志。
const WINDOWS_ILLEGAL = /[<>:"\\|?*\u0000-\u001f\u007f]/g;
const LEADING_DOTS = /^\.+/;

/**
 * 把任意字符串整理成安全的下载文件名：去掉目录成分、控制字符和 Windows 非法字符，
 * 避开保留设备名与点开头，并限制长度。输入可能是原文件名或用户起的标题，
 * 处理只在本机进行，不写日志、不进 URL，也不改动 blob 内容。
 */
function safeDownloadName(input: string): string {
  const withoutPath = input
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part !== '' && part !== '.' && part !== '..')
    .pop();

  let name = (withoutPath ?? '').replace(WINDOWS_ILLEGAL, '_').replace(LEADING_DOTS, '');
  name = name.trim().replace(/[. ]+$/, ''); // Windows 不允许名字以点或空格结尾

  if (name === '') name = FALLBACK_NAME;

  const dot = name.lastIndexOf('.');
  const hasExtension = dot > 0 && dot < name.length - 1;
  const base = (hasExtension ? name.slice(0, dot) : name).slice(0, MAX_BASENAME);
  // 扩展名保到 11 个字符，超长后缀（多半不是真的扩展名）在这里被截断。
  const extension = hasExtension ? name.slice(dot, dot + 12) : '';

  name = `${base || FALLBACK_NAME}${extension}`;
  // CON、LPT1 这类名字在 Windows 上无法创建文件，前加下划线绕开。
  if (WINDOWS_RESERVED.has(base.toLowerCase())) name = `_${name}`;
  return name;
}

/**
 * 让浏览器下载一段本机生成的 Blob。
 *
 * 不接收 URL、不发请求；ObjectURL 延迟释放，避免 Safari 下载失败。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeDownloadName(filename);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // 页面可能在此期间被关闭，定时器不会执行也无妨，浏览器会回收内存。
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** 人类可读的字节数，最多一位小数，例如 `1.5 MB`。负数与非法输入按 0 处理。 */
export function formatBytes(bytes: number): string {
  const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (size < 1024) return `${Math.round(size)} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // 999.95 KB 这类接近进位边界的值，四舍五入后再判断一次，避免出现 "1024 KB"。
  if (Math.round(value * 10) / 10 >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[unit]}`;
}
