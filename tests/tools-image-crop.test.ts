/**
 * 图片裁切的纯规则测试：真实文件头解析、导出像素换算与下载命名。
 *
 * 这些用例只依赖 image.ts（不碰 DOM、Canvas 与 cropperjs），所以可以在 Node 里跑。
 * 夹具用真实图片的字节头（PNG 签名 + IHDR、JPEG 段、RIFF/VP8X/VP8L/VP8），
 * 另外覆盖截断、伪装扩展名、超限与边界四舍五入。
 * 需要真实浏览器的部分（裁切位置、真实 MIME、透明与旋转）由主任务统一验证。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_BYTES,
  MAX_EXPORT_SIDE,
  MAX_PIXELS,
  exportSize,
  inspectImage,
  outputName,
} from '../src/tools/image-crop/image';

/** 断言抛出的是带中文说明的 Error，并可选校验关键字。 */
function rejects(run: () => unknown, keyword?: string): string {
  try {
    run();
  } catch (cause) {
    assert.ok(cause instanceof Error, '应抛出 Error');
    assert.ok(cause.message.length > 0, '错误信息不应为空');
    if (keyword) assert.ok(cause.message.includes(keyword), `错误信息应包含「${keyword}」：${cause.message}`);
    return cause.message;
  }
  throw new assert.AssertionError({ message: '这里本应抛出错误' });
}

/* ---------- 夹具 ---------- */

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** 拼接多段字节，方便把文件头按结构写清楚。 */
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u32be(value: number): Uint8Array {
  return bytes((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function u16be(value: number): Uint8Array {
  return bytes((value >>> 8) & 0xff, value & 0xff);
}

function u32le(value: number): Uint8Array {
  return bytes(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function u16le(value: number): Uint8Array {
  return bytes(value & 0xff, (value >>> 8) & 0xff);
}

function ascii(text: string): Uint8Array {
  return new Uint8Array([...text].map((character) => character.charCodeAt(0)));
}

/** PNG：8 字节签名 + IHDR（长度 13，宽高为数据前两项大端 32 位）。 */
function png(width: number, height: number): Uint8Array {
  return concat(
    bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    u32be(13),
    ascii('IHDR'),
    u32be(width),
    u32be(height),
    // IHDR 剩余的位深、颜色类型等；inspectImage 不读它们，只为让夹具更接近真实布局
    bytes(8, 6, 0, 0, 0),
    u32be(0), // 占位 CRC：本工具不校验 CRC
  );
}

/** JPEG：FF D8 + 若干段 + SOF0（长度 17，精度 8，高 2 字节、宽 2 字节）。 */
function jpeg(width: number, height: number, extraSegments: Uint8Array[] = []): Uint8Array {
  return concat(
    bytes(0xff, 0xd8),
    ...extraSegments,
    bytes(0xff, 0xc0),
    u16be(17),
    bytes(8),
    u16be(height),
    u16be(width),
    bytes(3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0),
  );
}

/** 一个带长度的普通段（如 APP0/JFIF），用于验证扫描能跳过它。
 *  段长度字段最短是 8（长度自身 2 + 6 字节内容），真实段都远大于它，这里补零到最短合法长度。 */
function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const padded = concat(payload, new Uint8Array(Math.max(0, 6 - payload.length)));
  return concat(bytes(0xff, marker), u16be(padded.length + 2), padded);
}

function riff(chunkType: string, payload: Uint8Array): Uint8Array {
  return concat(ascii('RIFF'), u32le(payload.length + 4), ascii('WEBP'), ascii(chunkType), u32le(payload.length), payload);
}

/** WebP 有损（VP8）：关键帧起始码 9D 01 2A，宽高各 14 位。 */
function webpLossy(width: number, height: number, flags = 0): Uint8Array {
  return riff('VP8 ', concat(bytes(0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a), u16le((flags << 14) | width), u16le(height)));
}

/** WebP 无损（VP8L）：0x2F 之后是 14 位宽-1 与 14 位高-1。 */
function webpLossless(width: number, height: number): Uint8Array {
  const packed = ((height - 1) << 14) | (width - 1);
  return riff('VP8L', concat(bytes(0x2f), u32le(packed)));
}

/** WebP 扩展（VP8X）：flags + 3 字节留白 + 24 位宽-1 + 24 位高-1。 */
function webpExtended(width: number, height: number, flags = 0): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  return riff(
    'VP8X',
    concat(bytes(flags, 0, 0, 0), bytes(w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff), bytes(h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff)),
  );
}

/* ---------- PNG ---------- */

test('PNG 只认签名与 IHDR，尺寸来自 IHDR 前两个大端 32 位', () => {
  assert.deepEqual(inspectImage(png(400, 300)), { mime: 'image/png', width: 400, height: 300 });
  assert.deepEqual(inspectImage(png(1, 1)), { mime: 'image/png', width: 1, height: 1 });
  // 两端字节不同的尺寸能证明按大端读取：读反了会变成 0x02010000 这种荒唐值
  assert.deepEqual(inspectImage(png(0x0102, 0x0304)), {
    mime: 'image/png',
    width: 0x0102,
    height: 0x0304,
  });
});

test('PNG 截断、签名不符或缺少 IHDR 都被拒绝', () => {
  const valid = png(400, 300);
  for (const length of [0, 1, 8, 12, 20, 23])
    rejects(() => inspectImage(valid.slice(0, length)), length === 0 ? '空' : '损坏');

  // 签名最后一个字节被改坏
  const brokenSignature = valid.slice();
  brokenSignature[7] = 0x00;
  rejects(() => inspectImage(brokenSignature), '损坏');

  // 第 13 个字节起不是 IHDR（例如 JPEG 里的 JFIF 段被误当成 PNG）
  const wrongChunk = valid.slice();
  wrongChunk.set(ascii('JHDR'), 12);
  rejects(() => inspectImage(wrongChunk), '损坏');
});

/* ---------- JPEG ---------- */

test('JPEG 扫描到 SOF 才认尺寸，并且能跳过前面带长度的段与填充', () => {
  assert.deepEqual(inspectImage(jpeg(640, 480)), { mime: 'image/jpeg', width: 640, height: 480 });
  assert.deepEqual(inspectImage(jpeg(1, 1)), { mime: 'image/jpeg', width: 1, height: 1 });

  // APP0(JFIF) + COM 注释段：扫描必须按 length 跳过，不能把它们当帧头
  const withSegments = jpeg(
    1200,
    800,
    [jpegSegment(0xe0, ascii('JFIF\0')), jpegSegment(0xfe, ascii('created by test'))],
  );
  assert.deepEqual(inspectImage(withSegments), { mime: 'image/jpeg', width: 1200, height: 800 });

  // APP0 里塞一个 C0 字节：内容不是标记，只有 FF C0 才是
  assert.deepEqual(inspectImage(jpeg(320, 240, [jpegSegment(0xe0, bytes(0xff, 0xc0, 0x00, 0x11))])), {
    mime: 'image/jpeg',
    width: 320,
    height: 240,
  });

  // 段间填充的连续 FF 与无长度的 RST0 都要跳过
  const withFill = concat(
    bytes(0xff, 0xd8, 0xff, 0xff, 0xd0),
    jpegSegment(0xe1, ascii('EXIF')),
    jpeg(640, 480).slice(2),
  );
  assert.deepEqual(inspectImage(withFill), { mime: 'image/jpeg', width: 640, height: 480 });

  // 字段位置：长度字段起点是 FF C0 之后那个字节，精度在 +2、高度 +3、宽度 +5
  const frame = jpeg(1024, 768);
  const lengthAt = frame.indexOf(0xc0) + 1;
  assert.equal(frame[lengthAt - 2], 0xff, 'SOF 标记前面应是 FF');
  assert.equal(frame[lengthAt - 1], 0xc0, '长度字段紧跟 SOF 标记');
  assert.deepEqual(frame.slice(lengthAt, lengthAt + 2), u16be(17), '段长度应为 17');
  assert.equal(frame[lengthAt + 2], 8, '精度应为 8');
  assert.deepEqual(frame.slice(lengthAt + 3, lengthAt + 5), u16be(768), '高度应在长度起点 +3');
  assert.deepEqual(frame.slice(lengthAt + 5, lengthAt + 7), u16be(1024), '宽度应在长度起点 +5');
});

test('JPEG 在 SOS 之前的每个 SOF 变体都算数，SOS 与截断则拒绝', () => {
  // 渐进式 C2、算术编码 C9 都属于「遇 SOS 前必须找到」的帧头
  for (const marker of [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) {
    const frame = jpeg(200, 100);
    frame[2] = 0xff;
    frame[3] = marker;
    assert.deepEqual(inspectImage(frame), { mime: 'image/jpeg', width: 200, height: 100 }, `SOF ${marker.toString(16)}`);
  }

  // C4（霍夫曼表）与 CC（算术编码条件）不是帧头，遇到它们必须继续往后找
  for (const marker of [0xc4, 0xcc]) {
    const frame = concat(
      bytes(0xff, 0xd8, 0xff, marker),
      u16be(10),
      bytes(0, 0, 0, 0, 0, 0, 0, 0),
      jpeg(200, 100).slice(2),
    );
    assert.deepEqual(inspectImage(frame), { mime: 'image/jpeg', width: 200, height: 100 });
  }

  // 只有 SOI 就开始扫描数据
  rejects(() => inspectImage(bytes(0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 2, 3)), '损坏');
  // 段长度声明得比实际字节多
  rejects(() => inspectImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 0, 0)), '损坏');
  // 段长度小于最短的 8
  rejects(() => inspectImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0, 0, 0, 0, 0, 0)), '损坏');
  // 标记后的字节不是 FF
  rejects(() => inspectImage(bytes(0xff, 0xd8, 0x00, 0x00)), '损坏');
  // 帧头里尺寸还没写完就结束
  rejects(() => inspectImage(bytes(0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 8, 0x01)), '损坏');
});

/* ---------- WebP ---------- */

test('WebP 三种块都能读尺寸：VP8X 加一、VP8L 低 14 位、VP8 关键帧起始码', () => {
  assert.deepEqual(inspectImage(webpExtended(400, 300)), { mime: 'image/webp', width: 400, height: 300 });
  assert.deepEqual(inspectImage(webpExtended(1, 1)), { mime: 'image/webp', width: 1, height: 1 });
  assert.deepEqual(inspectImage(webpLossless(400, 300)), { mime: 'image/webp', width: 400, height: 300 });
  assert.deepEqual(inspectImage(webpLossless(1, 1)), { mime: 'image/webp', width: 1, height: 1 });
  assert.deepEqual(inspectImage(webpLossy(400, 300)), { mime: 'image/webp', width: 400, height: 300 });
  assert.deepEqual(inspectImage(webpLossy(1, 1)), { mime: 'image/webp', width: 1, height: 1 });

  // 有损的 14 位尺寸里高两位是缩放信息，必须用 & 0x3fff 掩掉
  assert.deepEqual(inspectImage(webpLossy(300, 200, 3)), { mime: 'image/webp', width: 300, height: 200 });

  // 两种编码各自的边界值都要能完整读出：VP8X 用 24 位、VP8L/VP8 用 14 位
  assert.deepEqual(inspectImage(webpExtended(16383, 1953)), {
    mime: 'image/webp',
    width: 16383,
    height: 1953,
  });
  assert.deepEqual(inspectImage(webpLossless(16383, 1953)), {
    mime: 'image/webp',
    width: 16383,
    height: 1953,
  });
  // 16384 × 16384 = 268 MP，超出像素上限，必须拒绝
  rejects(() => inspectImage(webpLossless(16384, 16384)), '32 MP');
});

test('WebP 的 RIFF 结构、块长度与静态约束都要成立', () => {
  const valid = webpLossy(400, 300);
  for (const length of [0, 4, 11, 15, 20])
    rejects(() => inspectImage(valid.slice(0, length)), length === 0 ? '空' : '损坏');

  // RIFF 或 WEBP 标识不符
  const notWebp = valid.slice();
  notWebp.set(ascii('WAVE'), 8);
  rejects(() => inspectImage(notWebp), '损坏');

  // 块长度声明得比文件长（截断）
  const truncated = valid.slice(0, valid.length - 4);
  rejects(() => inspectImage(truncated), '损坏');

  // VP8L 的签名字节必须是 0x2F
  const badLossless = webpLossless(400, 300);
  badLossless[20] = 0x00;
  rejects(() => inspectImage(badLossless), '损坏');

  // VP8 的关键帧起始码 9D 01 2A 不对
  const badLossy = webpLossy(400, 300);
  badLossy[23] = 0x00;
  rejects(() => inspectImage(badLossy), '损坏');

  // VP8X 的动画位（0x02）必须拒绝，并说清只处理静态图
  rejects(() => inspectImage(webpExtended(400, 300, 0x02)), '动态 WebP');

  // 先出现的未知块（ICCP）要跳过，并按偶数长度对齐；长度只影响解析位置，不校验整包大小
  const withIccp = concat(
    ascii('RIFF'),
    u32le(4096),
    ascii('WEBP'),
    ascii('ICCP'),
    u32le(4),
    bytes(1, 2, 3, 4),
    webpLossy(400, 300).slice(12),
  );
  assert.deepEqual(inspectImage(withIccp), { mime: 'image/webp', width: 400, height: 300 });
});

/* ---------- 格式识别与上限 ---------- */

test('只认三种真实格式：假扩展名、伪装 MIME 与其他格式一律拒绝', () => {
  // 一个扩展名是 .png 的文本文件 / SVG：字节头对不上，不能靠文件名放行
  rejects(() => inspectImage(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), '只支持');
  rejects(() => inspectImage(ascii('GIF89a...')), '只支持');
  rejects(() => inspectImage(ascii('BM...')), '只支持');
  rejects(() => inspectImage(bytes(0x00, 0x01, 0x02, 0x03, 0x04, 0x05)), '只支持');

  // 空文件单独说清楚
  rejects(() => inspectImage(new Uint8Array(0)), '空');
});

test('超过 20 MiB 的文件在解析之前就被拒绝', () => {
  const oversized = new Uint8Array(MAX_BYTES + 1);
  rejects(() => inspectImage(oversized), '20 MiB');

  // 刚好等于上限的文件仍然进入格式判断（这里给的不是任何真实格式）
  const atLimit = new Uint8Array(MAX_BYTES);
  rejects(() => inspectImage(atLimit), '只支持');
});

test('尺寸为 0 或像素总量超过 32 MP 的图片被拒绝', () => {
  rejects(() => inspectImage(png(0, 300)), '尺寸不合法');
  rejects(() => inspectImage(png(400, 0)), '尺寸不合法');
  rejects(() => inspectImage(jpeg(0, 100)), '尺寸不合法');
  rejects(() => inspectImage(jpeg(100, 0)), '尺寸不合法');
  // VP8X / VP8L 的字段是「尺寸-1」，最小只能是 1；只有有损 VP8 的 14 位字段能取到 0
  rejects(() => inspectImage(webpLossy(0, 100)), '尺寸不合法');
  rejects(() => inspectImage(webpLossy(100, 0)), '尺寸不合法');
  assert.deepEqual(inspectImage(webpExtended(1, 1)), { mime: 'image/webp', width: 1, height: 1 });

  // 8000 × 4000 = 32 MP，正好在上限内；再多一行像素就超了
  assert.deepEqual(inspectImage(png(8000, 4000)), { mime: 'image/png', width: 8000, height: 4000 });
  rejects(() => inspectImage(png(8000, 4001)), '32 MP');
  rejects(() => inspectImage(jpeg(9000, 4000)), '32 MP');
  rejects(() => inspectImage(webpLossless(6000, 6000)), '32 MP');
});

/* ---------- 导出尺寸 ---------- */

test('导出高度按选区比例换算并四舍五入，宽度原样保留', () => {
  assert.deepEqual(exportSize(1200, 400, 300), { width: 1200, height: 900 });
  assert.deepEqual(exportSize(100, 3, 2), { width: 100, height: 67 }); // 66.67 → 67
  assert.deepEqual(exportSize(100, 2, 3), { width: 100, height: 150 });
  assert.deepEqual(exportSize(1, 1000, 1000), { width: 1, height: 1 });
  // 极扁的选区仍然至少 1 像素高，不会出现 0 高的画布
  assert.deepEqual(exportSize(10, 10000, 1), { width: 10, height: 1 });
  // 单边与总量都在上限内的方形导出
  assert.deepEqual(exportSize(4000, 1, 1), { width: 4000, height: 4000 });

  // 四舍五入的边界：.5 向上取整，略小于 .5 向下取整
  assert.equal(exportSize(100, 2, 1.01).height, 51); // 50.5 → 51
  assert.equal(exportSize(100, 2, 0.99).height, 50); // 49.5 → 50
  assert.equal(exportSize(100, 2, 0.98).height, 49); // 49 → 49
  assert.equal(exportSize(99, 1, 1).height, 99);
});

test('导出尺寸只接受整数宽度，越界或算不出来时抛错而不是悄悄改小', () => {
  rejects(() => exportSize(0, 100, 100), '1–8192');
  rejects(() => exportSize(-10, 100, 100), '1–8192');
  rejects(() => exportSize(8193, 100, 100), '1–8192');
  rejects(() => exportSize(120.5, 100, 100), '整数');
  rejects(() => exportSize(Number.NaN, 100, 100), '整数');

  // 选区为空（宽度或高度为 0、负数、非有限）时无法换算
  for (const [width, height] of [
    [0, 100],
    [100, 0],
    [-1, 100],
    [100, -1],
    [Number.NaN, 100],
    [100, Number.NaN],
    [Number.POSITIVE_INFINITY, 100],
    [100, Number.NEGATIVE_INFINITY],
  ])
    rejects(() => exportSize(1200, width!, height!), '选区为空');

  // 用户填的宽度不会被静默改小：算出高度越界时报错，并说清要调什么
  rejects(() => exportSize(8192, 10, 100), '调小导出宽度'); // 高度 81920：单边超限
  rejects(() => exportSize(4000, 1, 9), '调小导出宽度'); // 高度 36000：单边超限
  rejects(() => exportSize(8000, 3840, 2160), '调小导出宽度'); // 16:9 下高度 4500：单边没超，总量 36 MP
  rejects(() => exportSize(6000, 1, 1), '32 MP'); // 高度 6000：单边没超，总量超 32 MP
  rejects(() => exportSize(8192, 1, 1), '32 MP'); // 高度 8192：单边正好到顶，总量超
  assert.equal(MAX_EXPORT_SIDE, 8192);

  // 上限之内的高分辨率 16:9 导出照常允许：4000 × 2250 = 9 MP
  assert.deepEqual(exportSize(4000, 16, 9), { width: 4000, height: 2250 });
});

/* ---------- 下载命名 ---------- */

test('下载名只剥掉最后一个扩展名，换成所选格式的真实扩展名', () => {
  assert.equal(outputName('photo.png', 'image/png'), 'photo-裁切.png');
  assert.equal(outputName('photo.JPG', 'image/jpeg'), 'photo-裁切.jpg');
  assert.equal(outputName('photo.webp', 'image/webp'), 'photo-裁切.webp');
  assert.equal(outputName('photo.png', 'image/jpeg'), 'photo-裁切.jpg');
  assert.equal(outputName('a.b.c.png', 'image/png'), 'a.b.c-裁切.png');

  // 没有扩展名、或者点开头（.gitignore 那种）都按整体当基底名
  assert.equal(outputName('photo', 'image/png'), 'photo-裁切.png');
  assert.equal(outputName('.hidden', 'image/webp'), '.hidden-裁切.webp');
  // 结尾的点后面没有扩展名，按「最后一个点之前」截断，得到的是纯基底名
  assert.equal(outputName('photo.', 'image/png'), 'photo-裁切.png');
  // 目录成分由 shared/ui.ts 的 downloadBlob 再净化一次，这里原样保留
  assert.equal(outputName('dir/photo.jpg', 'image/jpeg'), 'dir/photo-裁切.jpg');

  // 空名字给出兜底基底名，不会是「-裁切.png」
  assert.equal(outputName('', 'image/png'), '图片-裁切.png');
});

test('下载名拒绝未支持的导出格式，不猜扩展名', () => {
  for (const mime of ['image/gif', 'image/svg+xml', 'text/html', 'application/octet-stream', ''])
    rejects(() => outputName('photo.png', mime), 'PNG');
});

test('上限常量与页面说明一致', () => {
  assert.equal(MAX_BYTES, 20 * 1024 * 1024);
  assert.equal(MAX_PIXELS, 32_000_000);
});
