/**
 * 压缩小页面的交互层。
 *
 * 页面本身不碰 7z 引擎：所有压缩、解压都在本页专属的 module Worker 里完成，
 * 文件字节不离开这台设备，也不写进 URL、console 或本地存储。
 *
 * 状态只有三种：待机（idle）、忙碌（busy）、上一次操作的结果。忙碌时只允许
 * 「取消」，其余按钮禁用；取消会终止并重建 worker，所以失败或取消之后仍然
 * 可以直接换一个文件重来，不会带着上一个任务的状态。
 */

import '../shared/style.css';
import { downloadBlob, formatBytes } from '../shared/ui';
import { ArchiveClient, ArchiveError } from './client';
import { phaseText } from './protocol';
import { readDroppedEntries, type DroppedItem } from './drop';
import {
  archiveNameForCreate,
  budgetError,
  checkCreateInputs,
  inputSizeError,
  limitsFor,
  normalizeEntryName,
  planExtraction,
  safeDownloadName,
  summarize,
  type ArchiveEntry,
  type CreateInput,
  type Level,
  type Limits,
} from './plan';

const root = document.querySelector<HTMLElement>('[data-archive]');
if (!root) throw new Error('archive root missing');

const elements = {
  tabs: [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')],
  panels: {
    extract: root.querySelector<HTMLElement>('[data-panel="extract"]')!,
    create: root.querySelector<HTMLElement>('[data-panel="create"]')!,
  },
  extractInput: root.querySelector<HTMLInputElement>('[data-extract-input]')!,
  extractZone: root.querySelector<HTMLElement>('[data-extract-zone]')!,
  password: root.querySelector<HTMLInputElement>('[data-password]')!,
  entryList: root.querySelector<HTMLElement>('[data-entries]')!,
  entrySummary: root.querySelector<HTMLElement>('[data-entry-summary]')!,
  selectAll: root.querySelector<HTMLButtonElement>('[data-select-all]')!,
  selectNone: root.querySelector<HTMLButtonElement>('[data-select-none]')!,
  extractSelected: root.querySelector<HTMLButtonElement>('[data-extract-selected]')!,
  createInput: root.querySelector<HTMLInputElement>('[data-create-input]')!,
  createFolder: root.querySelector<HTMLInputElement>('[data-create-folder]')!,
  createZone: root.querySelector<HTMLElement>('[data-create-zone]')!,
  createFiles: root.querySelector<HTMLElement>('[data-create-files]')!,
  format: root.querySelector<HTMLSelectElement>('[data-format]')!,
  level: root.querySelector<HTMLSelectElement>('[data-level]')!,
  createRun: root.querySelector<HTMLButtonElement>('[data-create-run]')!,
  createNone: root.querySelector<HTMLButtonElement>('[data-create-none]')!,
  // 两个面板各有一组取消/清空按钮，要一起接线，不能只取第一个。
  cancels: [...root.querySelectorAll<HTMLButtonElement>('[data-cancel]')],
  resets: [...root.querySelectorAll<HTMLButtonElement>('[data-reset]')],
  status: root.querySelector<HTMLElement>('[data-status]')!,
  alert: root.querySelector<HTMLElement>('[data-alert]')!,
  limitsText: root.querySelector<HTMLElement>('[data-limits]')!,
};

const limits: Limits = limitsFor(window.matchMedia('(max-width: 640px)').matches);
elements.limitsText.textContent = `单次上限：文件 ${formatBytes(limits.inputBytes)}、展开 ${formatBytes(limits.expandedBytes)}、${limits.entries} 个条目；只列出清单，确认后再解压。`;

const client = new ArchiveClient(new URL('../vendor/7z/', document.baseURI).href, {
  phase: (phase) => setStatus(phaseText(phase)),
});

let busy = false;
let entries: ArchiveEntry[] = [];
/**
 * 列表成功后记住这个 File。每次任务都是新 worker，所以解压时要把同一份
 * 字节重新带上；口令则取当前输入框的值，允许改完再重试。
 */
let openedFile: File | null = null;
/**
 * 操作序号：每次异步操作开始时 +1 并把当时的值当作 token。所有 await 之后
 * 都要对比 token，取消/清空/换文件之后回来的旧结果一律丢弃。
 */
let operation = 0;
let createQueue: DroppedItem[] = [];

function setStatus(text: string): void {
  elements.status.textContent = text;
}

function setAlert(text: string): void {
  elements.alert.textContent = text;
  elements.alert.hidden = text.length === 0;
}

function setBusy(value: boolean): void {
  busy = value;
  // 取消在忙碌时必须可用，其余入口一律锁住：包括文件输入、口令和下拉框，
  // 否则中途换文件会让界面上显示的内容和正在跑的任务对不上。
  for (const button of elements.cancels) {
    button.disabled = !value;
    button.hidden = !value;
  }
  for (const button of elements.resets) button.disabled = value;
  for (const button of [elements.selectAll, elements.selectNone, elements.createNone])
    button.disabled = value;
  elements.extractInput.disabled = value;
  elements.createInput.disabled = value;
  elements.createFolder.disabled = value;
  elements.password.disabled = value;
  elements.format.disabled = value;
  elements.level.disabled = value;
  for (const tab of elements.tabs) tab.disabled = value;
  for (const box of elements.entryList.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  )) {
    // 不安全/链接条目本来就不能选，解除忙碌时不要把它们打开。
    box.disabled = value || box.dataset.locked === 'true';
  }
  for (const list of [elements.entryList, elements.createFiles])
    for (const button of list.querySelectorAll<HTMLButtonElement>('button'))
      button.disabled = value;
  root!.dataset.busy = value ? 'true' : 'false';
  // 忙碌结束后由这两个函数按当前选择/队列重新决定按钮状态，
  // 否则会出现「什么都没选，解压按钮却是亮的」。
  updateExtractActions(false);
  updateCreateActions();
}

/** 失败提示只说稳定原因，不回显口令，也不把引擎原始日志丢到界面上。 */
function describe(error: unknown): string {
  if (error instanceof ArchiveError) return error.message;
  return '操作没有完成，请重试';
}

function entryLabel(entry: ArchiveEntry): string {
  const size = entry.folder ? '文件夹' : formatBytes(entry.size);
  const flags = [size];
  if (entry.encrypted) flags.push('加密');
  if (entry.link) flags.push('链接');
  return flags.join(' · ');
}

function renderEntries(): void {
  const selected = selectedNames();
  elements.entryList.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement('li');
    item.className = 'entry';
    if (entry.unsafe) item.classList.add('entry--unsafe');

    const label = document.createElement('label');
    label.className = 'entry__label';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = entry.name;
    box.checked = selected.has(entry.name);
    box.disabled = Boolean(entry.unsafe) || entry.link;
    box.dataset.locked = box.disabled ? 'true' : 'false';
    box.addEventListener('change', () => updateExtractActions());
    const name = document.createElement('span');
    name.className = 'entry__name';
    name.textContent = entry.folder ? `${entry.name}/` : entry.name;
    const meta = document.createElement('span');
    meta.className = 'entry__meta';
    meta.textContent = entry.unsafe ?? entryLabel(entry);
    label.append(box, name, meta);
    item.append(label);

    if (!entry.folder && !entry.link && !entry.unsafe) {
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'button button--ghost';
      save.textContent = '下载';
      save.addEventListener('click', () => void saveSingleEntry(entry));
      item.append(save);
    }
    elements.entryList.append(item);
  }
  const summary = summarize(entries);
  const budget = budgetError(summary, limits);
  elements.entrySummary.textContent =
    `${summary.files} 个文件、${summary.folders} 个文件夹，展开共 ${formatBytes(summary.totalBytes)}` +
    (summary.unsafe > 0 ? `；${summary.unsafe} 个条目不安全，已禁用` : '') +
    (budget ? `（${budget}）` : '');
  updateExtractActions();
}

function selectedNames(): Set<string> {
  const boxes = elements.entryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  return new Set([...boxes].filter((box) => box.checked).map((box) => box.value));
}

function updateExtractActions(announce = true): void {
  const count = selectedNames().size;
  elements.extractSelected.disabled = busy || count === 0;
  elements.extractSelected.textContent =
    count === 0 ? '解压选中的条目' : `解压选中的 ${count} 个条目并下载`;
  if (!announce || elements.panels.extract.hidden || count === 0) return;
  const sizes = new Map(entries.map((entry) => [entry.name, entry.size]));
  const total = [...selectedNames()].reduce((sum, name) => sum + (sizes.get(name) ?? 0), 0);
  setStatus(`已选择 ${count} 个条目，展开约 ${formatBytes(total)}。`);
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function is7zMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c].every((value, index) => bytes[index] === value)
  );
}

async function openArchive(file: File): Promise<void> {
  if (busy) return;
  setAlert('');
  const tooBig = inputSizeError(file.size, limits);
  if (tooBig) {
    entries = [];
    openedFile = null;
    renderEntries();
    setStatus('没有载入文件。');
    setAlert(tooBig);
    return;
  }
  // 先按魔数粗筛，避免明显不是压缩包的文件浪费时间；最终仍以引擎列表为准。
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!isZipMagic(head) && !is7zMagic(head)) {
    entries = [];
    openedFile = null;
    renderEntries();
    setStatus('没有载入文件。');
    setAlert('目前只支持 ZIP 和 7z 两种压缩包，这个文件不是其中之一。');
    return;
  }
  const token = ++operation;
  setBusy(true);
  setStatus(phaseText('listing'));
  try {
    const result = await client.inspect(file, elements.password.value, limits);
    if (token !== operation) return;
    entries = result.entries;
    openedFile = file;
    renderEntries();
    const summary = summarize(entries);
    setStatus(`已经列出 ${summary.files + summary.folders} 个条目，请选择要解压的内容。`);
    if (result.encryptedNames > 0 && elements.password.value.length === 0)
      setAlert('这个压缩包有加密条目，想要解出内容需要先填写口令。');
  } catch (error) {
    if (token !== operation) return;
    entries = [];
    openedFile = null;
    renderEntries();
    setStatus('没有载入文件。');
    setAlert(describe(error));
  } finally {
    if (token === operation) setBusy(false);
  }
}

async function saveSingleEntry(entry: ArchiveEntry): Promise<void> {
  if (busy) return;
  const source = openedFile;
  if (!source) {
    setAlert('请重新选择一次压缩文件，再解压。');
    return;
  }
  const plan = planExtraction(entries, [entry.name], limits);
  if (!plan.ok) {
    setAlert(plan.reason);
    return;
  }
  setAlert('');
  const token = ++operation;
  setBusy(true);
  try {
    // 口令取当前输入框：允许用户填好口令再点下载。
    const result = await client.extract(source, elements.password.value, plan.plan, limits);
    if (token !== operation) return;
    const file = result.files.find((item) => item.name === entry.name);
    if (!file) throw new ArchiveError('engine', '这个条目没有解出内容');
    downloadBlob(
      new Blob([file.bytes]),
      safeDownloadName(entry.name.split('/').pop() ?? entry.name),
    );
    setStatus('已经下载这个条目。');
  } catch (error) {
    if (token !== operation) return;
    setAlert(describe(error));
  } finally {
    if (token === operation) setBusy(false);
  }
}

async function extractSelected(): Promise<void> {
  if (busy) return;
  const source = openedFile;
  if (!source) {
    setAlert('请重新选择一次压缩文件，再解压。');
    return;
  }
  const selected = [...selectedNames()];
  const plan = planExtraction(entries, selected, limits);
  if (!plan.ok) {
    setAlert(plan.reason);
    return;
  }
  setAlert('');
  const token = ++operation;
  setBusy(true);
  try {
    const result = await client.extract(source, elements.password.value, plan.plan, limits);
    if (token !== operation) return;
    const single =
      result.files.length === 1 && result.directories.length === 0 && plan.plan.names.length === 1;
    if (single) {
      const only = result.files[0];
      downloadBlob(
        new Blob([only.bytes]),
        safeDownloadName(only.name.split('/').pop() ?? only.name),
      );
      setStatus('已经下载解出的文件。');
      return;
    }
    // 多个条目就用压缩引擎打成一个 ZIP：目录按目录传给引擎，不能当成 0 字节文件。
    const actualBytes = result.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
    const repacked = await client.create(
      'zip',
      'fast',
      result.files,
      result.directories,
      actualBytes,
      limits,
    );
    if (token !== operation) return;
    downloadBlob(
      new Blob([repacked.bytes], { type: 'application/zip' }),
      `${archiveBaseName()} 解压结果.zip`,
    );
    setStatus(
      `已经打包下载 ${result.files.length} 个文件、${result.directories.length} 个文件夹。`,
    );
  } catch (error) {
    if (token !== operation) return;
    setAlert(describe(error));
  } finally {
    if (token === operation) setBusy(false);
  }
}

function archiveBaseName(): string {
  const name = openedFile?.name ?? '';
  if (name.length === 0) return '解压结果';
  return safeDownloadName(name.replace(/\.[^./]+$/, ''), '解压结果');
}

function addCreateFiles(list: DroppedItem[]): void {
  if (busy) return;
  const next = [...createQueue];
  const existing = new Set(next.map((item) => item.name));
  for (const item of list) {
    const verdict = normalizeEntryName(item.name);
    if (!verdict.ok) {
      setAlert(`跳过 ${item.name}：${verdict.reason}`);
      continue;
    }
    if (existing.has(verdict.name)) continue;
    existing.add(verdict.name);
    next.push({ name: verdict.name, file: item.file });
  }
  const checked = checkCreateInputs(
    next.flatMap((item) => (item.file ? [{ name: item.name, size: item.file.size }] : [])),
    next.filter((item) => !item.file).map((item) => item.name),
    limits,
  );
  if (!checked.ok) {
    setAlert(checked.reason);
    return;
  }
  createQueue = next;
  renderCreateQueue();
}

function renderCreateQueue(): void {
  elements.createFiles.replaceChildren();
  let total = 0;
  for (const item of createQueue) {
    total += item.file?.size ?? 0;
    const row = document.createElement('li');
    row.className = 'entry';
    const name = document.createElement('span');
    name.className = 'entry__name';
    name.textContent = item.file ? item.name : `${item.name}/`;
    const meta = document.createElement('span');
    meta.className = 'entry__meta';
    meta.textContent = item.file ? formatBytes(item.file.size) : '空文件夹';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button--ghost';
    remove.textContent = '移除';
    remove.addEventListener('click', () => {
      createQueue = createQueue.filter((entry) => entry !== item);
      renderCreateQueue();
    });
    row.append(name, meta, remove);
    elements.createFiles.append(row);
  }
  // 这条状态只属于打包面板：解压面板没开时不要用它覆盖「选择一个压缩包」。
  if (!elements.panels.create.hidden) {
    if (createQueue.length === 0) setStatus('还没有加入要压缩的文件。');
    else setStatus(`待压缩 ${createQueue.length} 个条目，共 ${formatBytes(total)}。`);
  }
  updateCreateActions();
}

function updateCreateActions(): void {
  elements.createRun.disabled = busy || createQueue.length === 0;
  elements.createNone.disabled = busy || createQueue.length === 0;
}

async function runCreate(): Promise<void> {
  if (busy) return;
  // 以真实 File.size 先做一遍录入检查；读取之后还会再按实际字节数核对一次。
  const inputs: CreateInput[] = createQueue.flatMap((item) =>
    item.file ? [{ name: item.name, size: item.file.size }] : [],
  );
  const directories = createQueue.filter((item) => !item.file).map((item) => item.name);
  const check = checkCreateInputs(inputs, directories, limits);
  if (!check.ok) {
    setAlert(check.reason);
    return;
  }
  setAlert('');
  const token = ++operation;
  setBusy(true);
  setStatus(phaseText('packing'));
  try {
    const format = elements.format.value === '7z' ? '7z' : 'zip';
    const level = elements.level.value as Level;
    const queue = [...createQueue];
    const payload: Array<{ name: string; bytes: ArrayBuffer }> = [];
    let total = 0;
    for (const item of queue) {
      if (!item.file) continue;
      const bytes = await item.file.arrayBuffer();
      // 读盘可能很慢，中途换文件/清空之后不能再继续。
      if (token !== operation) return;
      total += bytes.byteLength;
      if (total > limits.inputBytes) {
        setAlert(`待压缩总量超过上限（${formatBytes(limits.inputBytes)}），已停止。`);
        return;
      }
      payload.push({ name: item.name, bytes });
    }
    const result = await client.create(format, level, payload, directories, total, limits);
    if (token !== operation) return;
    // 归档名沿用被压缩的第一个文件/文件夹，与常见的压缩工具习惯一致。
    downloadBlob(
      new Blob([result.bytes], { type: 'application/octet-stream' }),
      archiveNameForCreate(check.files, directories, format),
    );
    setStatus(`已经打包 ${result.entries} 个条目并开始下载。`);
  } catch (error) {
    if (token !== operation) return;
    setAlert(describe(error));
  } finally {
    if (token === operation) setBusy(false);
  }
}

/**
 * 拖入内容的读取。webkitGetAsEntry 必须在 drop 事件里同步调用，所以先同步
 * 取出一组条目，再异步展开目录；两者分开处理，避免同一个文件被收录两次。
 */
function droppedEntries(event: DragEvent): FileSystemEntry[] {
  const items = [...(event.dataTransfer?.items ?? [])].filter((item) => item.kind === 'file');
  return items
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);
}

function wireDrop(zone: HTMLElement, onFiles: (files: DroppedItem[]) => void): void {
  for (const type of ['dragenter', 'dragover'] as const) {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.dataset.drag = 'true';
    });
  }
  for (const type of ['dragleave', 'drop'] as const) {
    zone.addEventListener(type, () => {
      delete zone.dataset.drag;
    });
  }
  zone.addEventListener('drop', async (event) => {
    event.preventDefault();
    if (busy) return;
    // DataTransfer 在事件返回后会受保护：同步取出句柄和普通文件，再异步遍历。
    const tree = droppedEntries(event);
    const fallback = [...(event.dataTransfer?.files ?? [])].map((file) => ({
      name: file.name,
      file,
    }));
    const token = ++operation;
    setBusy(true);
    setAlert('');
    setStatus('正在读取拖入的条目…');
    try {
      const files = tree.length
        ? await readDroppedEntries(tree, limits, () => token === operation)
        : fallback;
      if (token !== operation) return;
      setBusy(false);
      if (!files.length) {
        setAlert('没有读到拖入的文件，请改用按钮选择。');
        return;
      }
      onFiles(files);
    } catch (error) {
      if (token === operation)
        setAlert(error instanceof Error ? error.message : '无法读取拖入的目录，请改用按钮选择。');
    } finally {
      if (token === operation) setBusy(false);
    }
  });
}

function setMode(mode: 'extract' | 'create'): void {
  for (const tab of elements.tabs) {
    const active = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  }
  elements.panels.extract.hidden = mode !== 'extract';
  elements.panels.create.hidden = mode !== 'create';
  setAlert('');
  if (mode === 'extract')
    setStatus(entries.length === 0 ? '选择一个 ZIP 或 7z 压缩包开始。' : '请选择要解压的内容。');
  else
    setStatus(
      createQueue.length === 0 ? '加入文件后就可以打包。' : `待压缩 ${createQueue.length} 个条目。`,
    );
}

function resetAll(): void {
  // 清空等于丢弃当前任务与列表，下一次操作会从全新的 worker 开始。
  operation += 1;
  client.dispose();
  entries = [];
  openedFile = null;
  createQueue = [];
  elements.password.value = '';
  elements.extractInput.value = '';
  elements.createInput.value = '';
  elements.createFolder.value = '';
  elements.entryList.replaceChildren();
  elements.createFiles.replaceChildren();
  elements.entrySummary.textContent = '';
  setAlert('');
  setBusy(false);
  setMode(elements.panels.create.hidden ? 'extract' : 'create');
}

for (const tab of elements.tabs) {
  tab.addEventListener('click', () =>
    setMode(tab.dataset.mode === 'create' ? 'create' : 'extract'),
  );
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tab.dataset.mode === 'create' ? 'extract' : 'create';
    setMode(next);
    elements.tabs.find((candidate) => candidate.dataset.mode === next)?.focus();
  });
}

elements.extractInput.addEventListener('change', () => {
  const file = elements.extractInput.files?.[0];
  if (file) void openArchive(file);
});
elements.password.addEventListener('change', () => {
  const file = elements.extractInput.files?.[0];
  if (file) void openArchive(file);
});
elements.selectAll.addEventListener('click', () => {
  for (const box of elements.entryList.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  )) {
    if (!box.disabled) box.checked = true;
  }
  updateExtractActions();
});
elements.selectNone.addEventListener('click', () => {
  for (const box of elements.entryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    box.checked = false;
  updateExtractActions();
});
elements.extractSelected.addEventListener('click', () => void extractSelected());
for (const button of elements.cancels) {
  button.addEventListener('click', () => {
    // 先让所有在飞的旧任务失去 token，再终止 worker。
    operation += 1;
    client.cancel();
    setStatus('已经取消这次操作。');
    setBusy(false);
  });
}
for (const button of elements.resets) {
  button.addEventListener('click', () => {
    resetAll();
    setStatus('已经清空，可以换一个文件。');
  });
}

elements.createInput.addEventListener('change', () => {
  const files = [...(elements.createInput.files ?? [])];
  addCreateFiles(files.map((file) => ({ name: file.webkitRelativePath || file.name, file })));
  elements.createInput.value = '';
});
elements.createFolder.addEventListener('change', () => {
  const files = [...(elements.createFolder.files ?? [])];
  addCreateFiles(files.map((file) => ({ name: file.webkitRelativePath || file.name, file })));
  elements.createFolder.value = '';
});
elements.createNone.addEventListener('click', () => {
  createQueue = [];
  renderCreateQueue();
});
elements.createRun.addEventListener('click', () => void runCreate());

wireDrop(elements.extractZone, (files) => {
  const first = files.find((item) => item.file);
  if (!first?.file) {
    setAlert('请拖入 ZIP 或 7z 文件，不是空目录。');
    return;
  }
  void openArchive(first.file);
});
wireDrop(elements.createZone, addCreateFiles);

window.addEventListener('pagehide', resetAll);

setBusy(false);
setMode('extract');
renderEntries();
// 首屏停在解压模式，队列为空时不要用打包面板的提示覆盖开场状态。
if (!elements.panels.create.hidden) renderCreateQueue();
else updateCreateActions();

/** 供调试与端到端检查使用的最小接口；不暴露文件内容与口令。 */
declare global {
  interface Window {
    archiveTool?: Record<string, unknown>;
  }
}
window.archiveTool = {
  limits,
  entryCount: () => entries.length,
  selected: () => [...selectedNames()],
};
