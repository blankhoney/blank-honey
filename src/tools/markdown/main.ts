/* 页面接线：文件 → 文本 → 净化后的 HTML。
 *
 * 输入只来自用户选择的文件；本页不请求网络、不写存储、不记录内容。
 * generation 是唯一的并发保护：每次 load/clear 都自增，异步回来的旧任务据此丢弃。
 */

import '../shared/style.css';
import './style.css';
import { formatBytes } from '../shared/ui';
import {
  MAX_FILE_BYTES,
  decodeMarkdown,
  displayName,
  isMarkdownFileName,
  isWithinSizeLimit,
} from './file';
import { markdownToHtml } from './pipeline';

const IDLE_STATUS = '还没有打开文件。放一份 .md 进来试试。';
const TOO_BIG = `文件超过 ${formatBytes(MAX_FILE_BYTES)}，这里不打开。`;
const WRONG_TYPE = '只支持 .md 与 .markdown 文件。';
const ONE_FILE = '一次只能放一份文件，请只选一个。';
const NOT_UTF8 = '这个文件不是 UTF-8 文本，读不出来。请确认编码后再试。';
const READ_FAILED = '读这个文件时出错了，请再试一次。';
const NO_DOM = '这个浏览器环境不支持净化渲染结果，为安全起见这里不显示。';

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`缺少必要元素：${selector}`);
  return element;
}

const fileInput = required<HTMLInputElement>(document, '#file-input');
const dropZone = required<HTMLLabelElement>(document, '#drop-zone');
const renderButton = required<HTMLButtonElement>(document, '#mode-render');
const sourceButton = required<HTMLButtonElement>(document, '#mode-source');
const clearButton = required<HTMLButtonElement>(document, '#clear');
const metadata = required<HTMLParagraphElement>(document, '#metadata');
const status = required<HTMLParagraphElement>(document, '#status');
const error = required<HTMLParagraphElement>(document, '#error');
const emptyState = required<HTMLParagraphElement>(document, '#empty-state');
const preview = required<HTMLElement>(document, '#preview');
const sourceView = required<HTMLPreElement>(document, '#source-view');
const sourceCode = required<HTMLElement>(document, '#source-code');
const readingFile = required<HTMLElement>(document, '#reading-file');

let generation = 0;
let source = '';
let fileName = '';
let mode: 'render' | 'source' = 'render';

function setStatus(text: string): void {
  status.textContent = text;
}

function setError(text: string): void {
  error.textContent = text;
  error.hidden = text === '';
}

/** 只按当前 mode 显示两个区域，切换不重新解析。 */
function showMode(): void {
  const hasFile = source !== '' || fileName !== '';
  const rendered = hasFile && mode === 'render';
  const raw = hasFile && mode === 'source';
  emptyState.hidden = hasFile;
  preview.hidden = !rendered;
  sourceView.hidden = !raw;
  renderButton.setAttribute('aria-pressed', String(mode === 'render'));
  sourceButton.setAttribute('aria-pressed', String(mode === 'source'));
}

function setModeButtonsEnabled(next: boolean): void {
  renderButton.disabled = !next;
  sourceButton.disabled = !next;
}

function clearRendered(): void {
  preview.replaceChildren();
  sourceCode.textContent = '';
  setStatus('');
  setError('');
  fileName = '';
  readingFile.textContent = '';
  metadata.textContent = '';
  metadata.hidden = true;
  setModeButtonsEnabled(false);
}

/** 释放本页持有的一切：文本、文件名、文件输入与结果区。 */
function clear(): void {
  generation += 1;
  source = '';
  mode = 'render';
  clearRendered();
  fileInput.value = '';
  setStatus(IDLE_STATUS);
  emptyState.hidden = false;
  preview.hidden = true;
  sourceView.hidden = true;
  showMode();
}

/** 这次没法读了：报错并退回空态，阅读区不留旧文也不留空白。 */
function fail(text: string): void {
  setError(text);
  setStatus(IDLE_STATUS);
  emptyState.hidden = false;
  preview.hidden = true;
  sourceView.hidden = true;
  setModeButtonsEnabled(false);
}

async function load(file: File): Promise<void> {
  const token = ++generation;
  clearRendered();
  emptyState.hidden = true;
  preview.hidden = true;
  sourceView.hidden = true;

  // 先按名字和大小筛掉，超限的文件根本不读。
  if (!isMarkdownFileName(file.name)) {
    fail(WRONG_TYPE);
    return;
  }
  if (!isWithinSizeLimit(file.size)) {
    fail(TOO_BIG);
    return;
  }

  setStatus('正在读取…');

  let text: string;
  try {
    const buffer = await file.arrayBuffer();
    if (token !== generation) return;
    text = decodeMarkdown(buffer);
  } catch (cause) {
    if (token === generation) fail(cause instanceof TypeError ? NOT_UTF8 : READ_FAILED);
    return;
  }

  let html: string;
  try {
    // 净化失败（例如没有 DOM）时不能把未净化的输出写进页面。
    html = markdownToHtml(text);
  } catch {
    if (token === generation) fail(NO_DOM);
    return;
  }
  if (token !== generation) return;

  source = text;
  fileName = displayName(file.name);

  // 本页唯一的 innerHTML 写入：内容是 sanitizeHtml 白名单过滤后的字符串。
  preview.innerHTML = html;
  sourceCode.textContent = source;
  readingFile.textContent = fileName;
  metadata.textContent = `${formatBytes(file.size)} · ${source.split('\n').length} 行`;
  metadata.hidden = false;
  mode = 'render';
  showMode();
  setModeButtonsEnabled(true);
  setStatus(`已打开 ${fileName}，内容只留在本页内存里。`);
}

function reportNoFile(): void {
  fail(ONE_FILE);
}

/* ---------- 事件 ---------- */

fileInput.addEventListener('change', () => {
  const [file] = Array.from(fileInput.files ?? []);
  if (!file) return;
  void load(file);
});

renderButton.addEventListener('click', () => {
  if (renderButton.disabled) return;
  mode = 'render';
  showMode();
});

sourceButton.addEventListener('click', () => {
  if (sourceButton.disabled) return;
  mode = 'source';
  showMode();
});

clearButton.addEventListener('click', clear);

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length === 0) return;
  if (files.length > 1) {
    reportNoFile();
    return;
  }
  const [file] = files;
  if (file) void load(file);
});

// 拖到页面别处时，只拦下浏览器默认的「打开这个文件」导航，不处理别的拖拽内容。
for (const type of ['dragover', 'drop']) {
  document.addEventListener(type, (event) => {
    const transfer = (event as DragEvent).dataTransfer;
    const types = Array.from(transfer?.types ?? []);
    if (!types.includes('Files')) return;
    event.preventDefault();
    if (type === 'dragover' && transfer) transfer.dropEffect = 'none';
  });
}

// 离开页面即释放：文本与结果区都不留着。
window.addEventListener('pagehide', clear);

showMode();
setModeButtonsEnabled(false);
setStatus(IDLE_STATUS);
