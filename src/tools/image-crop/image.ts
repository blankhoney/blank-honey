/* 图片裁切里可以脱离浏览器单独判断的规则：真实图片尺寸、导出像素与下载命名。
 *
 * 这里不引用 DOM、Canvas 或 cropperjs，方便直接跑单元测试。
 * 尺寸只从文件头读取：
 *   - 不信任扩展名，也不信任 File.type（浏览器给的 MIME 来自系统，jpg 改名成 txt 也能拿到 image/jpeg）；
 *   - 不重写解码器，不做 CRC 校验，只读够判断尺寸所需的最少字节；
 *   - 所有偏移都在读之前检查边界，越界按「截断/损坏」拒绝，绝不返回 NaN 尺寸。
 * 上限的理由：MAX_BYTES 限制单个文件读进内存的字节数，MAX_PIXELS 限制解码后的
 * 位图大小（一张 32MP 的图按 RGBA 展开约 128MB，桌面与手机都要留得住）。
 */

/** 单个图片文件的字节上限：20 MiB。 */
export const MAX_BYTES = 20 * 1024 * 1024;

/** 解码后的像素总量上限：32 MP。 */
export const MAX_PIXELS = 32_000_000;

/** 导出画布单边上限（与浏览器 Canvas 的实际可用范围对齐）。 */
export const MAX_EXPORT_SIDE = 8192;

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** 文件头里读出来的真实格式与像素尺寸。 */
export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

/** 拒绝原因直接用中文说清，页面原样展示。 */
function reject(reason: string): never {
  throw new Error(reason);
}

/** 大端 32 位无符号整数；越界返回 null（调用方负责拒绝）。 */
function readUint32BE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

/** 大端 16 位无符号整数；越界返回 null。 */
function readUint16BE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

/** 小端 32 位无符号整数；越界返回 null。 */
function readUint32LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

/** 小端 16 位无符号整数；越界返回 null。 */
function readUint16LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

/** 小端 24 位无符号整数；越界返回 null。 */
function readUint24LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 3 > bytes.length) return null;
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

/** 按 ASCII 比较一段字节，用于四字符标识（RIFF/WEBP 之类）。 */
function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset < 0 || offset + text.length > bytes.length) return false;
  for (let index = 0; index < text.length; index += 1)
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  return true;
}

/** PNG：8 字节签名 + 偏移 12 的 'IHDR'，宽高是 IHDR 数据里的前两个大端 32 位。 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPng(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 24) return null;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1)
    if (bytes[index] !== PNG_SIGNATURE[index]) return null;
  // 8 字节签名 + 4 字节长度，第 13 个字节起必须是 IHDR；不是就不是 PNG 数据流。
  if (!matchesAscii(bytes, 12, 'IHDR')) return null;
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (width === null || height === null) return null;
  return { mime: 'image/png', width, height };
}

/** JPEG 里带尺寸的帧头标记（SOF）：C0–CF 去掉无长度的 C4(霍夫曼表)、C8(保留)、CC(算术编码条件)。 */
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** 无长度字段的标记：SOI、EOI、RST0–RST7、TEM。 */
function isLengthlessMarker(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/**
 * JPEG：FF D8 之后逐个扫段，跳过填充用的 FF 与无长度标记，
 * 在遇到 SOS（之后的熵编码数据不再有段结构）之前必须找到 SOF。
 * 帧头里高度在长度字段后第 3、宽度第 5 字节处，都是大端 16 位。
 */
function readJpeg(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1; // 段间填充
    if (offset >= bytes.length) return null;

    const marker = bytes[offset]!;
    offset += 1;

    if (isLengthlessMarker(marker)) continue;
    if (marker === 0xda) return null; // SOS：已经进入扫描数据，说明没有可用的帧头

    const length = readUint16BE(bytes, offset);
    if (length === null || length < 8) return null;

    if (JPEG_SOF_MARKERS.has(marker)) {
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      if (width === null || height === null) return null;
      return { mime: 'image/jpeg', width, height };
    }

    offset += length; // length 含它自己的两个字节
  }
  return null;
}

/** WebP：RIFF 容器里逐块扫描，遇到带尺寸的块就返回，并拒绝动画容器。 */
function readWebp(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 12) return null;
  if (!matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = readUint32LE(bytes, offset + 4);
    if (size === null) return null;
    const payload = offset + 8;
    // 数据不足就按截断拒绝：宁可不给尺寸，也不拿半张图去解码。
    if (payload + size > bytes.length) return null;

    if (matchesAscii(bytes, offset, 'VP8X')) {
      if (size < 10) return null;
      const flags = bytes[payload]!;
      // 0x02 是动画位（ANIM）；本工具只处理静态图。
      if ((flags & 0x02) !== 0) reject('这是动态 WebP，本工具只处理静态图片');
      const width = readUint24LE(bytes, payload + 4);
      const height = readUint24LE(bytes, payload + 7);
      if (width === null || height === null) return null;
      return { mime: 'image/webp', width: width + 1, height: height + 1 };
    }

    if (matchesAscii(bytes, offset, 'VP8L')) {
      if (size < 5 || bytes[payload] !== 0x2f) return null;
      const packed = readUint32LE(bytes, payload + 1);
      if (packed === null) return null;
      // 无损：低 14 位是宽-1，接着 14 位是高-1。
      return {
        mime: 'image/webp',
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }

    if (matchesAscii(bytes, offset, 'VP8 ')) {
      if (size < 10) return null;
      // 关键帧起始码 9D 01 2A；然后两个 14 位尺寸（高两位是缩放信息）。
      const startCode =
        bytes[payload + 3] === 0x9d && bytes[payload + 4] === 0x01 && bytes[payload + 5] === 0x2a;
      if (!startCode) return null;
      const width = readUint16LE(bytes, payload + 6);
      const height = readUint16LE(bytes, payload + 8);
      if (width === null || height === null) return null;
      return { mime: 'image/webp', width: width & 0x3fff, height: height & 0x3fff };
    }

    // 未识别的块（ICCP、EXIF、XMP…）跳过；RIFF 的块按偶数长度对齐。
    offset = payload + size + (size % 2);
  }
  return null;
}

/**
 * 从文件字节判断真实格式与尺寸。
 *
 * 只认 PNG / JPEG / WebP 三种；其余格式、伪装扩展名、截断文件都会抛出中文错误。
 * 三种格式统一要求宽高为正整数，且像素总量不超过 MAX_PIXELS。
 */
export function inspectImage(bytes: Uint8Array): ImageInfo {
  if (bytes.length === 0) reject('这个文件是空的，没有可以读取的内容');
  if (bytes.length > MAX_BYTES) reject('图片超过 20 MiB 上限，请先压缩再裁切');

  const info = readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
  if (!info) reject('只支持 PNG、JPEG、WebP 三种图片，或文件已经损坏、被截断');

  if (!Number.isInteger(info.width) || !Number.isInteger(info.height) || info.width < 1 || info.height < 1)
    reject('图片尺寸不合法，无法裁切');
  if (info.width * info.height > MAX_PIXELS) reject('图片超过 32 MP 上限，解码会占用过多内存');

  return info;
}

/**
 * 把「选区在图片上的比例」换算成导出像素尺寸。
 *
 * 用户填的宽度就是最终宽度，不会因为高度超限被悄悄改小；不合法时直接报错，
 * 让页面把原因说清楚。选区两维必须有限且大于 0（选区为 0 时不生成预览）。
 */
export function exportSize(
  width: number,
  selectionWidth: number,
  selectionHeight: number,
): { width: number; height: number } {
  if (!Number.isInteger(width) || width < 1 || width > MAX_EXPORT_SIDE)
    reject(`导出宽度需为 1–${MAX_EXPORT_SIDE} 之间的整数`);

  if (
    !Number.isFinite(selectionWidth) ||
    !Number.isFinite(selectionHeight) ||
    selectionWidth <= 0 ||
    selectionHeight <= 0
  )
    reject('当前选区为空，请先在图上框出要保留的范围');

  const height = Math.max(1, Math.round((width * selectionHeight) / selectionWidth));
  if (height > MAX_EXPORT_SIDE) reject(`按当前选区比例换算的高度超过 ${MAX_EXPORT_SIDE} 像素，请调小导出宽度`);
  if (width * height > MAX_PIXELS) reject('导出像素总量超过 32 MP，请调小导出宽度');

  return { width, height };
}

/** MIME 对应的文件扩展名；只在这三种导出格式里取值。 */
const OUTPUT_EXTENSIONS: Record<ImageMime, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/** 没有扩展名或名字为空时的基底名。 */
const FALLBACK_BASE = '图片';

/**
 * 下载名：只剥掉最后一个扩展名，加上 `-裁切` 与所选格式的真实扩展名。
 * 不做路径/非法字符净化（那是 shared/ui.ts 里 downloadBlob 的职责）。
 */
export function outputName(original: string, mime: string): string {
  const extension = OUTPUT_EXTENSIONS[mime as ImageMime];
  if (!extension) reject(`不支持导出为 ${mime}，请在 PNG、JPEG、WebP 中选择`);

  const dot = original.lastIndexOf('.');
  // 点开头（.gitignore 这种）不当作扩展名，保持原样。
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base === '' ? FALLBACK_BASE : base}-裁切${extension}`;
}
