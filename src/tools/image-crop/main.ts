/* 图片裁切页的接线：读取文件 → 交给 cropperjs 的裁切画布 → 导出真实位图 → 下载。
 *
 * 几个约束决定了下面的写法：
 *   - 图片只在内存里流转：Blob URL 由本模块持有并释放，页面不发请求、不写存储、不打印文件名。
 *   - cropperjs v2 的 Cropper 只负责在容器里插入 <cropper-canvas> 等自定义元素，
 *     换图时必须先 destroy()（它会移除 canvas 并恢复原 <img> 的 display），
 *     再把上一张的 <img> 和 Blob URL 一起丢掉，否则节点与解码位图都会留在内存里。
 *   - 所有异步步骤（读文件、解码、导出）都用 generation / revision 两个计数器判定是否过期：
 *     过期结果只清理自己申请的资源，绝不覆盖新图片的状态。
 */

import Cropper, { DEFAULT_TEMPLATE } from 'cropperjs';
import '../shared/style.css';
import './style.css';
import { downloadBlob, formatBytes } from '../shared/ui';
import {
  MAX_BYTES,
  MAX_EXPORT_SIDE,
  MAX_PIXELS,
  exportSize,
  inspectImage,
  outputName,
  type ImageMime,
} from './image';

/** 裁切模板沿用 cropperjs 默认结构，只改选区一行：
 *  初始覆盖工作区 80%，保持可选、可缩放，并打开键盘与精确坐标
 *  （precise 让拖拽与输入不被四舍五入到整 CSS 像素，键盘方向键另有 1px 步进）。 */
const TEMPLATE = DEFAULT_TEMPLATE.replace(
  '<cropper-selection initial-coverage="0.5" movable resizable>',
  '<cropper-selection initial-coverage="0.8" movable resizable keyboard precise>',
);

/** 手柄与选中框颜色跟随本工具的点缀色；--accent 由 body[data-tool] 给出，亮暗两套都生效。 */
const THEME_COLOR = 'var(--accent)';

/** 缩放按钮每次的步进，与 cropperjs 的 scaleStep 保持一致。 */
const ZOOM_STEP = 0.1;

/** 导出宽度的初始值上限：图片再大也不默认导出成巨图。 */
const DEFAULT_EXPORT_WIDTH = 1200;

const MIME_LABELS: Record<ImageMime, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`缺少必要元素：${selector}`);
  return element;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : '发生了未知错误，请重试';
}

const stage = required<HTMLDivElement>(document, '#stage');
const stageEmpty = required<HTMLParagraphElement>(document, '#stage-empty');
const stageMeta = required<HTMLElement>(document, '#stage-meta');
const imageMeta = required<HTMLElement>(document, '#image-meta');
const dropZone = required<HTMLDivElement>(document, '#drop');
const fileInput = required<HTMLInputElement>(document, '#file');
const controls = required<HTMLFieldSetElement>(document, '#controls');
const ratioButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#ratios .ratio'));
const rotateLeft = required<HTMLButtonElement>(document, '#rotate-left');
const rotateRight = required<HTMLButtonElement>(document, '#rotate-right');
const zoomOut = required<HTMLButtonElement>(document, '#zoom-out');
const zoomIn = required<HTMLButtonElement>(document, '#zoom-in');
const resetButton = required<HTMLButtonElement>(document, '#reset');
const selX = required<HTMLInputElement>(document, '#sel-x');
const selY = required<HTMLInputElement>(document, '#sel-y');
const selW = required<HTMLInputElement>(document, '#sel-w');
const selH = required<HTMLInputElement>(document, '#sel-h');
const selectionInputs = [selX, selY, selW, selH];
const exportWidth = required<HTMLInputElement>(document, '#export-width');
const exportHeight = required<HTMLInputElement>(document, '#export-height');
const formatSelect = required<HTMLSelectElement>(document, '#format');
const qualityRange = required<HTMLInputElement>(document, '#quality');
const qualityValue = required<HTMLOutputElement>(document, '#quality-value');
const generateButton = required<HTMLButtonElement>(document, '#generate');
const downloadButton = required<HTMLButtonElement>(document, '#download');
const clearButton = required<HTMLButtonElement>(document, '#clear');
const status = required<HTMLParagraphElement>(document, '#status');
const error = required<HTMLParagraphElement>(document, '#error');
const previewSlot = required<HTMLDivElement>(document, '#preview-slot');
const previewImage = required<HTMLImageElement>(document, '#preview-image');
const previewMeta = required<HTMLParagraphElement>(document, '#preview-meta');

// 界面里的上限直接来自 image.ts 的常量，避免两边漂移。
exportWidth.max = String(MAX_EXPORT_SIDE);

/* ---------- 模块内状态（没有第二个实例，不需要类） ---------- */

/** 每换一次图片 +1；在途的读文件/解码/导出结果只要对不上就丢弃。 */
let generation = 0;
/** 图片或选区每变一次 +1；导出的预览必须与生成时一致才能保存。 */
let revision = 0;
let cropper: Cropper | null = null;
let sourceImage: HTMLImageElement | null = null;
/** cropperjs 内部图片用的 Blob URL：由本模块创建，也在本模块释放。 */
let sourceURL: string | null = null;
/** 预览图的 Blob URL，与 resultBlob 同生共死。 */
let previewURL: string | null = null;
let sourceName = '';
let resultBlob: Blob | null = null;
let resultFilename = '';
/** 当前固定比例；NaN 表示自由裁切。 */
let selectionRatio = Number.NaN;

function setStatus(text: string, tone?: 'busy' | 'ok'): void {
  status.textContent = text;
  if (tone) status.dataset.tone = tone;
  else status.removeAttribute('data-tone');
}

function setError(text: string): void {
  error.textContent = text;
  error.hidden = text === '';
}

/** 释放当前图片相关的全部资源：Cropper 节点、原 <img>、两个 Blob URL、预览与导出结果。 */
function disposeImage(): void {
  generation += 1; // 先让在途的异步结果过期，后面的清理才不会被它们抢回去

  if (cropper) {
    // cropperjs 只在 keyboard 被显式关掉时才解绑挂在 document 上的 keydown 监听；
    // 直接 destroy() 会把监听留在 document 上，让整棵已摘除的元素树无法回收。
    const selection = cropper.getCropperSelection();
    if (selection) selection.keyboard = false;
    cropper.destroy(); // 移除 <cropper-canvas> 并恢复原元素的 display
    cropper = null;
  }
  if (sourceImage) {
    sourceImage.removeAttribute('src'); // 断开引用，避免最后一张图被继续解码保留
    sourceImage.remove();
    sourceImage = null;
  }
  if (sourceURL) {
    URL.revokeObjectURL(sourceURL);
    sourceURL = null;
  }

  revision += 1;
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
  previewImage.removeAttribute('src');
  previewMeta.textContent = '';
  previewSlot.hidden = true;
  resultBlob = null;
  resultFilename = '';

  sourceName = '';
  controls.disabled = true;
  generateButton.disabled = false; // 在途导出的按钮状态属于上一代，这里恢复成可用的默认值
  downloadButton.disabled = true;
  stageEmpty.hidden = false;
  stageMeta.textContent = '还没有图片';
  imageMeta.textContent = '未载入图片';
  for (const input of selectionInputs) input.value = '';
  exportWidth.value = '';
  exportHeight.value = '';
  selectRatio('free');
}

/**
 * 用最新几何刷新四个数字输入。
 *
 * 选区 change 事件是在内部赋值**之前**派发的，所以事件回调必须把 detail 传进来；
 * 事件之外（图片变换、重置）没有新几何，再回头读选区当前属性。
 */
type SelectionGeometry = { x: number; y: number; width: number; height: number };

function syncSelectionInputs(geometry?: SelectionGeometry): void {
  const selection = cropper?.getCropperSelection();
  if (!selection) {
    for (const input of selectionInputs) input.value = '';
    return;
  }
  const { x, y, width, height } = geometry ?? selection;
  selX.value = String(Math.round(x));
  selY.value = String(Math.round(y));
  selW.value = String(Math.round(width));
  selH.value = String(Math.round(height));
}

/** 只读的导出高度：由导出宽度与选区比例算出，非法时留空，让用户看到「算不出来」。 */
function syncExportHeight(selectionWidth?: number, selectionHeight?: number): void {
  const selection = cropper?.getCropperSelection();
  const width = selectionWidth ?? selection?.width;
  const height = selectionHeight ?? selection?.height;
  if (width === undefined || height === undefined) {
    exportHeight.value = '';
    return;
  }
  try {
    exportHeight.value = String(exportSize(Number(exportWidth.value), width, height).height);
  } catch {
    exportHeight.value = '';
  }
}

/** 图片或选区变化后作废已有的预览与下载结果，避免下载到过期的图。 */
function invalidateResult(): void {
  revision += 1;
  resultBlob = null;
  resultFilename = '';
  downloadButton.disabled = true;
  previewSlot.hidden = true;
  previewImage.removeAttribute('src');
  previewMeta.textContent = '';
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
}

/** 选区或图片的几何变化统一走这里：同步输入框、作废旧结果。
 *  选区事件发生在 cropperjs 内部赋值之前，几何要按事件 detail 传入，不能回头读旧属性。 */
function onGeometryChanged(geometry?: SelectionGeometry): void {
  syncSelectionInputs(geometry);
  syncExportHeight(geometry?.width, geometry?.height);
  invalidateResult();
}

/* ---------- 加载图片 ---------- */

async function loadFile(file: File): Promise<void> {
  disposeImage();
  const token = generation; // disposeImage 已经 +1，这一代就是本次加载
  controls.disabled = true;
  setError('');
  setStatus('正在读取图片…', 'busy');

  let localURL: string | null = null;
  try {
    // 先看体积再读进内存：超过上限的文件连字节都不需要读。
    if (file.size > MAX_BYTES) throw new Error('图片超过 20 MiB 上限，请先压缩再裁切');

    const buffer = await file.arrayBuffer();
    if (token !== generation) return; // 期间换了别的文件，这次读取作废

    const info = inspectImage(new Uint8Array(buffer));

    // 按文件头判定的真实格式重新造 Blob：不信 file.type，也不接受 SVG/HTML 伪装成的图片。
    const blob = new Blob([buffer], { type: info.mime });
    localURL = URL.createObjectURL(blob);

    const image = document.createElement('img');
    image.style.imageOrientation = 'from-image'; // 明确按 EXIF 方向显示，旋转交给浏览器
    image.alt = '待裁切的图片';
    image.src = localURL;
    try {
      // blob: 地址不会被别人改，解码失败基本等于文件本身损坏或中途截断。
      await image.decode();
    } catch {
      throw new Error('浏览器无法解码这张图片，文件可能已损坏或被截断');
    }
    // 迟到的解码结果只清理自己的 URL，绝不碰新任务的状态。
    if (token !== generation) {
      URL.revokeObjectURL(localURL);
      return;
    }

    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < 1 || height < 1) throw new Error('图片解码后没有有效尺寸，可能已经损坏');
    // 文件头读到的是解码前尺寸；这里按浏览器解出的真实位图再校验一次像素总量。
    if (width * height > MAX_PIXELS) throw new Error('图片超过 32 MP 上限，解码会占用过多内存');

    // 交接所有权：从这里开始资源归模块状态管，任何异常都由下面的 catch 统一释放。
    sourceURL = localURL;
    localURL = null;
    sourceImage = image;
    sourceName = file.name;

    stageEmpty.hidden = true;
    stage.append(image);
    cropper = new Cropper(image, { container: stage, template: TEMPLATE });
    cropper.getCropperCanvas()?.setAttribute('theme-color', THEME_COLOR);

    const cropperImage = cropper.getCropperImage();
    const selection = cropper.getCropperSelection();
    if (!cropperImage || !selection) throw new Error('裁切组件没有初始化成功，请刷新后重试');

    // 选区与图片变换都会改变导出内容：任一变化都记一版，过期的导出结果不再保存。
    selection.addEventListener('change', (event) => {
      onGeometryChanged((event as CustomEvent<SelectionGeometry>).detail);
    });
    cropperImage.addEventListener('transform', () => onGeometryChanged());

    await cropperImage.$ready(); // 内部图片就绪后选区与手柄才可用
    if (token !== generation) return;

    imageMeta.textContent = `${width} × ${height} 像素 · ${MIME_LABELS[info.mime]} · ${formatBytes(file.size)}`;
    stageMeta.textContent = `原图 ${width} × ${height} 像素`;
    exportWidth.value = String(Math.min(width, DEFAULT_EXPORT_WIDTH));
    controls.disabled = false;
    selectRatio('free');
    syncExportHeight();
    setStatus('已载入图片。拖动裁切框调整范围，然后生成预览。', 'ok');
  } catch (cause) {
    if (localURL) URL.revokeObjectURL(localURL);
    if (token !== generation) return;
    // 载入过程中已经接管的资源要一起收回，别把半张图留在页面上。
    if (cropper || sourceImage) disposeImage();
    setError(messageOf(cause));
    setStatus('图片没有载入，可以换一张再试。');
  }
}

/* ---------- 比例、旋转与缩放 ---------- */

function selectRatio(key: string): void {
  selectionRatio = key === 'free' ? Number.NaN : Number(key);
  for (const button of ratioButtons)
    button.setAttribute('aria-pressed', String(button.dataset.ratio === key));
}

/** 固定比例：在工作区里框出一块能放下的居中选区（四周留 10% 余量）。 */
function applyFixedRatio(ratio: number): void {
  const canvas = cropper?.getCropperCanvas();
  const selection = cropper?.getCropperSelection();
  if (!canvas || !selection) return;

  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  if (canvasWidth <= 0 || canvasHeight <= 0) return;

  const width = Math.min(canvasWidth * 0.8, canvasHeight * 0.8 * ratio);
  const height = width / ratio;
  const x = (canvasWidth - width) / 2;
  const y = (canvasHeight - height) / 2;
  // 先记住比例（后续拖拽也保持），再用本次比例立刻改选区几何。
  selection.aspectRatio = ratio;
  selection.$change(x, y, width, height, ratio);
}

function handleRatioClick(button: HTMLButtonElement): void {
  const key = button.dataset.ratio ?? 'free';
  const ratio = Number(key);
  selectRatio(key);

  // 自由比例：解除固定，但保留用户已经框好的选区，不重新居中。
  if (!Number.isFinite(ratio) || ratio <= 0) {
    const selection = cropper?.getCropperSelection();
    if (selection) selection.aspectRatio = Number.NaN;
    return;
  }
  applyFixedRatio(ratio);
}

/** 把四个数字输入当成一次「移动/改尺寸」指令；越界就夹回工作区里。 */
function applySelectionInputs(): void {
  const canvas = cropper?.getCropperCanvas();
  const selection = cropper?.getCropperSelection();
  if (!canvas || !selection) return;

  const values = [selX, selY, selW, selH].map((input) => Number(input.value));
  if (values.some((value) => !Number.isFinite(value))) {
    syncSelectionInputs(); // 不是数字就还原成真实选区，不给画布塞 NaN
    return;
  }
  let [x = 0, y = 0, width = 0, height = 0] = values as [number, number, number, number];
  if (width <= 0 || height <= 0) {
    syncSelectionInputs();
    return;
  }

  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  const fixed = Number.isFinite(selectionRatio) && selectionRatio > 0 ? selectionRatio : Number.NaN;

  if (Number.isFinite(fixed)) height = width / fixed; // 固定比例时以宽度为准
  width = Math.min(width, canvasWidth);
  height = Math.min(height, canvasHeight);
  if (Number.isFinite(fixed)) {
    width = Math.min(width, height * fixed);
    height = width / fixed;
  }
  x = Math.min(Math.max(0, x), Math.max(0, canvasWidth - width));
  y = Math.min(Math.max(0, y), Math.max(0, canvasHeight - height));

  selection.$change(x, y, width, height, fixed);
  // 夹回后的几何可能与原来相同，Cropper 此时不发 change；输入仍须显示实际值。
  syncSelectionInputs();
  syncExportHeight();
}

/* ---------- 导出 ---------- */

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('浏览器没有生成图片数据，请重试或换个格式'));
      },
      mime,
      quality,
    );
  });
}

async function generatePreview(): Promise<void> {
  const cropperCanvas = cropper?.getCropperCanvas();
  const selection = cropper?.getCropperSelection();
  if (!cropperCanvas || !selection) return;

  const token = generation;
  const expected = revision; // 生成期间只要图或选区变了，这次结果就不作数
  setError('');

  let size: { width: number; height: number };
  try {
    size = exportSize(Number(exportWidth.value), selection.width, selection.height);
  } catch (cause) {
    setError(messageOf(cause));
    return;
  }

  const mime = formatSelect.value as ImageMime;
  const quality = Number(qualityRange.value);

  // 生成期间禁用主按钮、画布指针交互与键盘微调：选区一动，导出的内容就对不上了。
  // （键盘监听挂在 document 上，只设 canvas.disabled 拦不住它。）
  generateButton.disabled = true;
  cropperCanvas.disabled = true;
  selection.keyboard = false;
  setStatus('正在生成预览…', 'busy');

  try {
    const exportCanvas = await selection.$toCanvas({
      width: size.width,
      height: size.height,
      // JPEG 没有 alpha：透明区域必须先铺白，否则会变成黑色。
      beforeDraw(context, canvas) {
        if (mime !== 'image/jpeg') return;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      },
    });

    // Cropper 按原选区比例再算一次尺寸，赋给 canvas 时会向下取整。
    // 只在相差像素时补齐用户确认的整数尺寸，避免预览说明与实际下载不一致。
    let outputCanvas = exportCanvas;
    if (exportCanvas.width !== size.width || exportCanvas.height !== size.height) {
      outputCanvas = document.createElement('canvas');
      outputCanvas.width = size.width;
      outputCanvas.height = size.height;
      const context = outputCanvas.getContext('2d');
      if (!context) throw new Error('浏览器无法创建导出画布，请减小尺寸再试');
      if (mime === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size.width, size.height);
      }
      context.drawImage(exportCanvas, 0, 0, size.width, size.height);
    }
    const blob = await toBlob(outputCanvas, mime, quality);
    // 浏览器不支持该格式时会悄悄回退成 PNG：核对 MIME，绝不冒充已经转换成功。
    if (blob.type !== mime)
      throw new Error(`这台浏览器没有导出 ${MIME_LABELS[mime]}，请改用其他格式`);

    if (token !== generation) return;
    if (expected !== revision) {
      // 只收掉当前图片的旧预览状态，不覆盖后来载入的图片。
      setStatus('图片或选区在生成期间发生了变化，请重新生成预览。');
      return;
    }

    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(blob);
    resultBlob = blob;
    resultFilename = outputName(sourceName, mime);
    previewImage.src = previewURL;
    previewMeta.textContent = `${size.width} × ${size.height} 像素 · ${formatBytes(blob.size)} · ${MIME_LABELS[mime]}`;
    previewSlot.hidden = false;
    downloadButton.disabled = false;
    setStatus(`预览已生成：${size.width} × ${size.height} 像素，${formatBytes(blob.size)}。`, 'ok');
  } catch (cause) {
    if (token === generation) setError(messageOf(cause));
  } finally {
    // 只恢复自己这一代的状态；换代时由 disposeImage 负责收尾，
    // 此时 cropperCanvas 还可能被它的回调使用，交给下一轮的 disposeImage 处理。
    if (token === generation) {
      cropperCanvas.disabled = false;
      selection.keyboard = true;
      generateButton.disabled = false;
    }
  }
}

/* ---------- 事件接线 ---------- */

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void loadFile(file);
});

// 拖入是增强：文件输入始终可用。
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
  const file = event.dataTransfer?.files?.[0];
  if (file) void loadFile(file);
});

for (const button of ratioButtons) button.addEventListener('click', () => handleRatioClick(button));

rotateLeft.addEventListener('click', () => cropper?.getCropperImage()?.$rotate('-90deg'));
rotateRight.addEventListener('click', () => cropper?.getCropperImage()?.$rotate('90deg'));
zoomOut.addEventListener('click', () => cropper?.getCropperImage()?.$zoom(-ZOOM_STEP));
zoomIn.addEventListener('click', () => cropper?.getCropperImage()?.$zoom(ZOOM_STEP));
resetButton.addEventListener('click', () => {
  const cropperImage = cropper?.getCropperImage();
  const selection = cropper?.getCropperSelection();
  if (!cropperImage || !selection) return;
  // 顺序有讲究：先解除固定比例，再改几何，否则 $change 会按旧比例再算一遍尺寸。
  selectRatio('free');
  selection.aspectRatio = Number.NaN;
  cropperImage.$resetTransform();
  cropperImage.$center('contain');
  selection.$reset(); // 回到 initial-coverage 定下的初始选区
  selection.$center();
  onGeometryChanged();
  setStatus('视图与裁切框已重置。');
});

for (const input of selectionInputs) input.addEventListener('change', () => applySelectionInputs());

exportWidth.addEventListener('change', () => {
  syncExportHeight();
  invalidateResult();
});
exportHeight.addEventListener('change', () => syncExportHeight()); // 只读，兜底防手改

formatSelect.addEventListener('change', () => {
  setError('');
  invalidateResult();
});
qualityRange.addEventListener('input', () => {
  qualityValue.textContent = String(Number(qualityRange.value));
  invalidateResult();
});

generateButton.addEventListener('click', () => {
  if (generateButton.disabled) return;
  void generatePreview();
});

downloadButton.addEventListener('click', () => {
  if (!resultBlob) return;
  downloadBlob(resultBlob, resultFilename);
  setStatus(`已开始下载 ${resultFilename}。`, 'ok');
});

clearButton.addEventListener('click', () => {
  disposeImage();
  fileInput.value = '';
  setError('');
  setStatus('已清空图片，可以再放一张进来。');
});

// 关闭或离开页面时立刻释放 Blob URL 与裁切节点，不给浏览器留下悬挂引用。
window.addEventListener('pagehide', () => {
  disposeImage();
  fileInput.value = '';
});

qualityValue.textContent = qualityRange.value;
