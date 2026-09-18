/**
 * 压缩工具里可以脱离浏览器和 wasm 引擎单独判断的规则：
 * 条目名安全、资源预算、提取范围、下载命名与超时。
 *
 * 这里不引用 DOM、Worker 或 7z-wasm，方便直接跑单元测试。
 * 所有判断都基于浏览器里真实观察到的 7-Zip 行为（见 tests/tools-archive.test.ts）：
 * 提取用「相对名 + -spd + -i@ 选项文件」，条目名里带 CR/LF 无法写进选项文件，
 * 因此这类条目必须被拒绝，而不能拆成多个名字。
 */

export interface Limits {
  /** 单个压缩包字节上限。 */
  inputBytes: number;
  /** 声明展开总量上限（所有条目 Size 之和）。 */
  expandedBytes: number;
  /** 条目数上限。 */
  entries: number;
}

export const DEFAULT_LIMITS: Limits = {
  inputBytes: 100 * 1024 * 1024,
  expandedBytes: 256 * 1024 * 1024,
  entries: 1000,
};

/** 手机屏幕更小、内存更紧张，预算相应降低；UI 会把实际数值写出来。 */
export const COMPACT_LIMITS: Limits = {
  inputBytes: 48 * 1024 * 1024,
  expandedBytes: 128 * 1024 * 1024,
  entries: 300,
};

export function limitsFor(isCompact: boolean): Limits {
  return isCompact ? COMPACT_LIMITS : DEFAULT_LIMITS;
}

export type NameVerdict = { ok: true; name: string } | { ok: false; reason: string };

/** C0 控制字符与 DEL：会破坏 -i@ 选项文件的行结构，也不该出现在文件名里。 */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const MAX_NAME_LENGTH = 4096;

/**
 * 条目名进入引擎前先规范化：统一用 '/'，去掉结尾斜杠，并拒绝危险形状。
 * 绝对路径、'..'、反斜杠、控制字符都会破坏「提取到沙箱目录」的假设。
 */
export function normalizeEntryName(raw: string): NameVerdict {
  if (raw.length === 0) return { ok: false, reason: '名称为空' };
  if (raw.length > MAX_NAME_LENGTH) return { ok: false, reason: '名称过长' };
  if (CONTROL_CHARS.test(raw)) return { ok: false, reason: '名称包含换行或控制字符' };
  if (raw.includes('\\')) return { ok: false, reason: '名称包含反斜杠分隔符' };
  if (raw.startsWith('/')) return { ok: false, reason: '绝对路径' };
  if (/^[a-zA-Z]:/.test(raw)) return { ok: false, reason: '绝对路径' };
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.length === 0) return { ok: false, reason: '名称为空' };
  for (const segment of trimmed.split('/')) {
    if (segment.length === 0) return { ok: false, reason: '名称包含空的路径段' };
    if (segment === '..') return { ok: false, reason: '包含目录穿越（..）' };
  }
  return { ok: true, name: trimmed };
}

export interface ArchiveEntry {
  /** 规范化后的条目名，'/' 分隔，无结尾斜杠。 */
  name: string;
  /** 归档里的目录条目。 */
  folder: boolean;
  /** 未压缩大小（字节）。 */
  size: number;
  /** 压缩后大小（字节）。 */
  packedSize: number;
  /** 条目内容加密。 */
  encrypted: boolean;
  /** 符号链接或硬链接成员：不能安全解出普通文件。 */
  link: boolean;
  /** 不安全原因，存在时该条目不可提取。 */
  unsafe?: string;
}

export interface Summary {
  files: number;
  folders: number;
  links: number;
  unsafe: number;
  /** 所有条目声明大小之和。 */
  totalBytes: number;
}

export function summarize(entries: ArchiveEntry[]): Summary {
  let files = 0;
  let folders = 0;
  let links = 0;
  let unsafe = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    if (entry.link) links += 1;
    if (entry.folder) folders += 1;
    else files += 1;
    if (entry.unsafe) unsafe += 1;
    totalBytes += entry.size;
  }
  return { files, folders, links, unsafe, totalBytes };
}

export function formatLimitBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}

/** 列表阶段的预算判断：先看清单，超出预算就不进入解压。 */
export function budgetError(summary: Summary, limits: Limits): string | null {
  if (summary.files + summary.folders > limits.entries)
    return `条目数超过上限（${limits.entries} 个），已停止`;
  if (summary.totalBytes > limits.expandedBytes)
    return `声明的展开总量超过上限（${formatLimitBytes(limits.expandedBytes)}），已停止`;
  return null;
}

export function inputSizeError(size: number, limits: Limits): string | null {
  if (size > limits.inputBytes)
    return `文件超过上限（${formatLimitBytes(limits.inputBytes)}），已停止`;
  return null;
}

/** 选中一个目录条目时，把它下面的所有条目一起取出。 */
export function expandSelection(entries: ArchiveEntry[], selected: string[]): string[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const result: string[] = [];
  for (const name of selected) {
    if (!byName.has(name)) continue;
    result.push(name);
    if (!byName.get(name)!.folder) continue;
    const prefix = `${name}/`;
    for (const entry of entries) {
      if (entry.name.startsWith(prefix)) result.push(entry.name);
    }
  }
  return [...new Set(result)];
}

export interface ExtractPlan {
  /** 交给 -i@ 选项文件的条目名，顺序与清单一致。 */
  names: string[];
  /** 需要显式建立的空目录（含选中目录本身）。 */
  directories: string[];
  /** 计划展开的字节数。 */
  totalBytes: number;
  /** 每个文件的预检大小；解压后要逐条核对实际字节数。 */
  sizes: Record<string, number>;
  /**
   * 用户最初选中的条目（去重副本），不是展开后的列表、也不含推导出的父目录。
   * worker 重做计划时只能用它：用展开列表会连带未选中的兄弟文件，
   * 用补出来的父目录会把整棵兄弟树都拉进来。
   */
  selected: string[];
}

export type PlanResult = { ok: true; plan: ExtractPlan } | { ok: false; reason: string };

export function planExtraction(
  entries: ArchiveEntry[],
  selected: string[],
  limits: Limits,
): PlanResult {
  if (selected.length === 0) return { ok: false, reason: '还没有选择要解压的条目' };
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  for (const name of selected) {
    const entry = byName.get(name);
    if (!entry) return { ok: false, reason: '选择的条目已不在清单里，请重新选择文件' };
    if (entry.unsafe) return { ok: false, reason: `条目不安全：${entry.unsafe}` };
    if (entry.link) return { ok: false, reason: '压缩包里有符号链接，本工具不解出链接' };
  }
  const expanded = expandSelection(entries, selected);
  const wanted = new Set(expanded);
  const names: string[] = [];
  const directories: string[] = [];
  const sizes: Record<string, number> = Object.create(null);
  let totalBytes = 0;
  for (const entry of entries) {
    if (!wanted.has(entry.name)) continue;
    if (entry.unsafe) return { ok: false, reason: `条目不安全：${entry.unsafe}` };
    if (entry.link) return { ok: false, reason: '压缩包里有符号链接，本工具不解出链接' };
    // 名带 CR/LF 的条目无法无歧义写进 -i@ 选项文件，只能整体拒绝。
    if (entry.name.includes('\n') || entry.name.includes('\r'))
      return { ok: false, reason: '含有换行符的条目名，无法安全解压' };
    if (entry.folder) directories.push(entry.name);
    else {
      names.push(entry.name);
      sizes[entry.name] = entry.size;
    }
    totalBytes += entry.size;
  }
  if (names.length === 0 && directories.length === 0)
    return { ok: false, reason: '选择的条目没有可提取的内容' };
  if (names.length + directories.length > limits.entries)
    return { ok: false, reason: `选择的条目数超过上限（${limits.entries} 个）` };
  if (totalBytes > limits.expandedBytes)
    return {
      ok: false,
      reason: `选择的展开量超过上限（${formatLimitBytes(limits.expandedBytes)}）`,
    };
  // 补齐隐式父目录，提取后即使原包没有目录条目也能得到完整层级。
  const withParents = new Set(directories);
  for (const name of names) {
    const parts = name.split('/');
    parts.pop();
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part;
      withParents.add(prefix);
    }
  }
  return {
    ok: true,
    plan: {
      names,
      directories: [...withParents].sort(),
      totalBytes,
      sizes,
      selected: [...new Set(selected)],
    },
  };
}

/** 用于 -i@ 选项文件：每个名字占一行，因此名字里不能有 CR/LF（调用前已保证）。 */
export function selectedListFile(names: string[]): string {
  return names.map((name) => `${name}\n`).join('');
}

export interface CreateInput {
  /** 归档内路径，'/' 分隔，来自文件输入或目录拖入。 */
  name: string;
  size: number;
}

export type CreateCheck =
  { ok: true; files: CreateInput[]; directories: string[] } | { ok: false; reason: string };

/**
 * 创建前的检查：名字安全、去重、数量与总量预算。
 * 归档名保持相对路径并用 '--' 保护 '-' 开头的名字，参数数组不经过 shell。
 */
export function checkCreateInputs(
  files: CreateInput[],
  directories: string[],
  limits: Limits,
): CreateCheck {
  if (files.length === 0 && directories.length === 0)
    return { ok: false, reason: '还没有加入任何文件' };
  const seen = new Set<string>();
  const safeFiles: CreateInput[] = [];
  let totalBytes = 0;
  for (const file of files) {
    const verdict = normalizeEntryName(file.name);
    if (!verdict.ok) return { ok: false, reason: `无法收录 ${file.name}：${verdict.reason}` };
    if (seen.has(verdict.name)) continue;
    seen.add(verdict.name);
    const size = Math.max(0, Math.trunc(file.size));
    safeFiles.push({ name: verdict.name, size });
    totalBytes += size;
  }
  const safeDirs: string[] = [];
  for (const dir of directories) {
    const verdict = normalizeEntryName(dir);
    if (!verdict.ok) return { ok: false, reason: `无法收录目录：${verdict.reason}` };
    if (seen.has(verdict.name)) continue;
    seen.add(verdict.name);
    safeDirs.push(verdict.name);
  }
  if (safeFiles.length + safeDirs.length > limits.entries)
    return { ok: false, reason: `条目数超过上限（${limits.entries} 个）` };
  if (totalBytes > limits.inputBytes)
    return { ok: false, reason: `待压缩总量超过上限（${formatLimitBytes(limits.inputBytes)}）` };
  return { ok: true, files: safeFiles, directories: safeDirs };
}

/** 默认归档名：单个文件/目录时沿用它的名字，否则用中性名称。 */
export function archiveNameForCreate(
  files: CreateInput[],
  directories: string[],
  format: 'zip' | '7z',
): string {
  const suffix = format === '7z' ? '7z' : 'zip';
  const first = files[0]?.name ?? directories[0] ?? '';
  const base = first.split('/')[0] ?? '';
  const stem = base.replace(/\.[^./]+$/, '');
  const name = stem.length > 0 ? safeDownloadName(stem, '打包结果') : '打包结果';
  return `${name}.${suffix}`;
}

const DOWNLOAD_FALLBACK = 'download';

/** 下载文件名：去掉路径分隔符、控制字符和前导点，避免奇怪的落盘名。 */
export function safeDownloadName(raw: string, fallback = DOWNLOAD_FALLBACK): string {
  const cleaned = raw
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/^[.\s]+/, '')
    .trim();
  return (cleaned.length > 0 ? cleaned : fallback).slice(0, 180);
}

/** 压缩级别下拉框的取值，映射到 7-Zip 的 -mx。 */
export type Level = 'fast' | 'normal' | 'max';

export function levelValue(level: Level): string {
  if (level === 'fast') return '-mx=1';
  if (level === 'max') return '-mx=9';
  return '-mx=5';
}

export function levelLabel(level: Level): string {
  if (level === 'fast') return '快速';
  if (level === 'max') return '最小体积';
  return '标准';
}

/** worker 侧的任务超时：按输入大小放宽，避免大文件被误杀，同时给出兜底上限。 */
export function timeoutMsFor(inputBytes: number): number {
  const base = 20_000;
  const perMiB = 1_000;
  const cap = 300_000;
  return Math.min(cap, base + Math.ceil(inputBytes / (1024 * 1024)) * perMiB);
}

/** 读取错误日志时保留结尾：7-Zip 把错误和汇总放在最后。 */
export function tailOfLog(log: string, maxLength = 4096): string {
  return log.length <= maxLength ? log : log.slice(log.length - maxLength);
}

export type FailureCode =
  'password' | 'corrupt' | 'unsupported' | 'budget' | 'unsafe' | 'engine' | 'timeout' | 'cancelled';

/**
 * 把引擎日志归到稳定的失败码。日志可能带本机路径，所以只回稳定的中文说明，
 * 不把原始日志（更不会把口令）交给 UI。
 */
export function classifyFailure(log: string): { code: FailureCode; message: string } {
  if (/wrong password|cannot open encrypted|password is incorrect|enter password/i.test(log))
    return {
      code: 'password',
      message: '口令不正确，或该压缩包需要口令。填写口令后请重新选择文件。',
    };
  // 7z 把整个头加密时（-mhe=on），不给口令只报 E_FAIL，读不出「需要口令」这句话。
  if (/ : opening : e_fail/i.test(log))
    return { code: 'password', message: '打不开这个压缩包：它可能需要口令，也可能已经损坏' };
  if (/unsupported method|not implemented|unsupported/i.test(log))
    return { code: 'unsupported', message: '这个压缩包的算法暂不支持' };
  if (/is not archive|cannot open the file as|can't open as archive|errors: [1-9]/i.test(log))
    return { code: 'corrupt', message: '无法识别这个压缩包，可能不是压缩文件或已损坏' };
  return { code: 'engine', message: '压缩引擎没有完成这次操作' };
}
