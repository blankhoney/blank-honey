/**
 * 主线程与 7z worker 之间的消息定义，也是协议校验的唯一来源。
 *
 * 两侧都引用这里，避免出现「主线程以为发了什么、worker 以为收到什么」的偏差。
 * 由于 worker 的 message 事件只能拿到 unknown，这里提供逐字段校验。
 */

import type { ArchiveEntry, ExtractPlan, FailureCode, Level, Limits, Summary } from './plan';

export interface InitRequest {
  type: 'init';
  /** 引擎所在目录的绝对 URL，由主线程从 document.baseURI 推出来。 */
  engineUrl: string;
}

export interface InspectRequest {
  type: 'inspect';
  id: number;
  /** 归档字节副本；用 copy 而不是 transfer，worker 需要留住它供后续提取。 */
  archive: ArrayBuffer;
  password: string;
  limits: Limits;
}

export interface ExtractRequest {
  type: 'extract';
  id: number;
  /** 与 inspect 返回的清单对应的条目名。 */
  plan: ExtractPlan;
  /** 重新带上归档字节与当前口令：每次任务都是新 worker，不保留上次的状态。 */
  archive: ArrayBuffer;
  password: string;
  limits: Limits;
}

export interface CreateRequest {
  type: 'create';
  id: number;
  format: 'zip' | '7z';
  level: Level;
  /** 归档内相对路径（'/' 分隔）与内容；名字已由主线程校验。 */
  files: Array<{ name: string; bytes: ArrayBuffer }>;
  directories: string[];
  limits: Limits;
}

export type WorkerRequest = InitRequest | InspectRequest | ExtractRequest | CreateRequest;

/** worker 回传的单个文件内容。 */
export interface OutputFile {
  name: string;
  bytes: ArrayBuffer;
}

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'phase'; id: number; phase: Phase }
  | {
      type: 'inspected';
      id: number;
      entries: ArchiveEntry[];
      summary: Summary;
      encryptedNames: number;
    }
  | { type: 'extracted'; id: number; files: OutputFile[]; directories: string[] }
  | { type: 'created'; id: number; bytes: ArrayBuffer; entries: number }
  | { type: 'failed'; id: number; code: FailureCode; message: string };

export type Phase = 'reading' | 'listing' | 'extracting' | 'packing';

export function phaseText(phase: Phase): string {
  switch (phase) {
    case 'reading':
      return '正在读取文件…';
    case 'listing':
      return '正在查看压缩包内容…';
    case 'extracting':
      return '正在解压…';
    case 'packing':
      return '正在打包…';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLimits(value: unknown): value is Limits {
  return (
    isObject(value) &&
    typeof value.inputBytes === 'number' &&
    typeof value.expandedBytes === 'number' &&
    typeof value.entries === 'number'
  );
}

function isPlan(value: unknown): value is ExtractPlan {
  return (
    isObject(value) &&
    Array.isArray(value.names) &&
    value.names.every((name) => typeof name === 'string') &&
    Array.isArray(value.directories) &&
    value.directories.every((name) => typeof name === 'string') &&
    typeof value.totalBytes === 'number' &&
    isObject(value.sizes) &&
    Object.values(value.sizes).every((size) => typeof size === 'number') &&
    Array.isArray(value.selected) &&
    value.selected.every((name) => typeof name === 'string')
  );
}

/** worker 侧解析主线程消息；无法识别的消息直接返回 null，由调用方报错。 */
export function parseRequest(value: unknown): WorkerRequest | null {
  if (!isObject(value) || typeof value.type !== 'string') return null;
  if (typeof value.id !== 'number' || !Number.isFinite(value.id)) {
    if (value.type === 'init' && typeof value.engineUrl === 'string')
      return { type: 'init', engineUrl: value.engineUrl };
    return null;
  }
  const id = value.id;
  switch (value.type) {
    case 'inspect':
      if (
        value.archive instanceof ArrayBuffer &&
        typeof value.password === 'string' &&
        isLimits(value.limits)
      )
        return {
          type: 'inspect',
          id,
          archive: value.archive,
          password: value.password,
          limits: value.limits,
        };
      return null;
    case 'extract':
      if (
        isPlan(value.plan) &&
        value.archive instanceof ArrayBuffer &&
        typeof value.password === 'string' &&
        isLimits(value.limits)
      )
        return {
          type: 'extract',
          id,
          plan: value.plan,
          archive: value.archive,
          password: value.password,
          limits: value.limits,
        };
      return null;
    case 'create':
      if (
        (value.format === 'zip' || value.format === '7z') &&
        isLevel(value.level) &&
        isLimits(value.limits)
      )
        return {
          type: 'create',
          id,
          format: value.format,
          level: value.level,
          files: parseCreateFiles(value.files),
          directories: Array.isArray(value.directories)
            ? value.directories.filter((dir): dir is string => typeof dir === 'string')
            : [],
          limits: value.limits,
        };
      return null;
    default:
      return null;
  }
}

function parseCreateFiles(value: unknown): Array<{ name: string; bytes: ArrayBuffer }> {
  if (!Array.isArray(value)) return [];
  const files: Array<{ name: string; bytes: ArrayBuffer }> = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.name !== 'string' || !(item.bytes instanceof ArrayBuffer))
      continue;
    files.push({ name: item.name, bytes: item.bytes });
  }
  return files;
}

function isLevel(value: unknown): value is Level {
  return value === 'fast' || value === 'normal' || value === 'max';
}

/**
 * 主线程侧校验 worker 回传，防止把结构不对的消息当成结果。
 * 这里的字段都来自引擎内部，用法接近断言而不是宽容解析。
 */
export function parseResponse(value: unknown): WorkerResponse | null {
  if (!isObject(value) || typeof value.type !== 'string') return null;
  if (value.type === 'ready') return { type: 'ready' };
  if (typeof value.id !== 'number') return null;
  const id = value.id;
  switch (value.type) {
    case 'phase':
      if (isPhase(value.phase)) return { type: 'phase', id, phase: value.phase };
      return null;
    case 'inspected':
      if (
        isEntries(value.entries) &&
        isSummary(value.summary) &&
        typeof value.encryptedNames === 'number'
      )
        return {
          type: 'inspected',
          id,
          entries: value.entries,
          summary: value.summary,
          encryptedNames: value.encryptedNames,
        };
      return null;
    case 'extracted':
      if (isOutputFiles(value.files) && Array.isArray(value.directories))
        return {
          type: 'extracted',
          id,
          files: value.files,
          directories: value.directories.filter((dir): dir is string => typeof dir === 'string'),
        };
      return null;
    case 'created':
      if (value.bytes instanceof ArrayBuffer && typeof value.entries === 'number')
        return { type: 'created', id, bytes: value.bytes, entries: value.entries };
      return null;
    case 'failed':
      if (typeof value.code === 'string' && typeof value.message === 'string')
        return { type: 'failed', id, code: value.code as FailureCode, message: value.message };
      return null;
    default:
      return null;
  }
}

function isEntries(value: unknown): value is ArchiveEntry[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      isObject(entry) &&
      typeof entry.name === 'string' &&
      typeof entry.folder === 'boolean' &&
      typeof entry.size === 'number' &&
      typeof entry.packedSize === 'number' &&
      typeof entry.encrypted === 'boolean' &&
      typeof entry.link === 'boolean' &&
      (entry.unsafe === undefined || typeof entry.unsafe === 'string'),
  );
}

function isSummary(value: unknown): value is Summary {
  return (
    isObject(value) &&
    typeof value.files === 'number' &&
    typeof value.folders === 'number' &&
    typeof value.links === 'number' &&
    typeof value.unsafe === 'number' &&
    typeof value.totalBytes === 'number'
  );
}

function isOutputFiles(value: unknown): value is OutputFile[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (file) => isObject(file) && typeof file.name === 'string' && file.bytes instanceof ArrayBuffer,
  );
}

function isPhase(value: unknown): value is Phase {
  return (
    value === 'reading' || value === 'listing' || value === 'extracting' || value === 'packing'
  );
}
