/**
 * 对 7z-wasm 引擎的收窄封装：列表、解压、打包三种操作，加上把零散日志
 * 收成有上限的文本。
 *
 * 三条硬约束（都在真实引擎上确认过）：
 * 1. 提取只认「相对名 + -spd + -i@ 选项文件」，把条目名当普通参数会被当通配符；
 * 2. 每个操作新建一个引擎实例，操作完就把整个实例丢掉，压缩包字节留在 JS 里，
 *    这样两次操作之间不会互相看到对方的文件系统残留；
 * 3. 参数是数组不是命令行字符串，口令、名字都不经过 shell，也不写进日志。
 *
 * 本文件不导入 7z-wasm，工厂函数由调用方注入：浏览器 worker 用动态 import
 * 取 lab-dist 里的引擎，测试直接用 node_modules 里的包。
 */

import {
  classifyFailure,
  levelValue,
  normalizeEntryName,
  checkCreateInputs,
  summarize,
  tailOfLog,
  type ArchiveEntry,
  type ExtractPlan,
  type FailureCode,
  type Level,
  type Limits,
  type Summary,
} from './plan';

/** 引擎实例里我们真正用到的最小面。 */
export interface EngineInstance {
  FS: {
    mkdir(path: string): unknown;
    readdir(path: string): string[];
    lstat(path: string): { mode: number; size: number };
    isDir(mode: number): boolean;
    isLink(mode: number): boolean;
    writeFile(path: string, data: ArrayBufferView | string): void;
    readFile(path: string): Uint8Array;
    chdir(path: string): void;
  };
  callMain(args: string[]): number;
}

export interface EngineOptions {
  print?(text: string): void;
  printErr?(text: string): void;
  locateFile?(path: string, scriptDirectory: string): string;
  wasmBinary?: ArrayBuffer;
  quit?(code: number, status?: unknown): void;
}

export type EngineFactory = (options: EngineOptions) => Promise<EngineInstance>;

/** 对外报错的日志只留结尾：7-Zip 把错误和统计放在最后。 */
export const LOG_TAIL_LIMIT = 64 * 1024;

/**
 * 解析用的日志必须完整，所以这里给的上限远大于任何合理清单。
 * 一旦真的触顶就标记溢出：宁可拒绝这次操作，也不能拿被截断的清单去解析，
 * 那会少算条目数和展开量，把预算检查变成摆设。
 */
export const LOG_CAPACITY = 4 * 1024 * 1024;

export class LogSink {
  private text = '';
  private overflowed = false;

  /**
   * 引擎的 print/printErr 是**按行**回调的，一行一个 chunk（不带换行）。
   * 这里补回换行，否则 `l -slt` 的 key=value 行会连成一整行，解析必然失败。
   */
  write(chunk: string): void {
    if (this.overflowed) return;
    this.text += `${chunk}\n`;
    if (this.text.length > LOG_CAPACITY) {
      this.overflowed = true;
      this.text = '';
    }
  }

  /** 解析用：只有未溢出时才有意义。 */
  get value(): string {
    return this.text;
  }

  get truncated(): boolean {
    return this.overflowed;
  }

  /** 报错用：只留结尾，且允许在溢出之后继续调用。 */
  tail(): string {
    return tailOfLog(this.text, LOG_TAIL_LIMIT);
  }
}

export class EngineFailure extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly log = '',
  ) {
    super(message);
  }
}

/** 引擎内部的固定路径；不含任何用户数据，写进日志也不暴露输入。 */
const WORK = '/w';
const SOURCE = '/w/src';
const SANDBOX = '/w/out';
const ARCHIVE = '/w/target.bin';
const OUTPUT = '/w/created.bin';
const LIST_FILE = '/w/selected.txt';

function mkdirp(engine: EngineInstance, path: string): void {
  const parts = path.split('/').filter((part) => part.length > 0);
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    try {
      engine.FS.mkdir(current);
    } catch {
      // 已存在就继续：父目录被重复创建不算错误。
    }
  }
}

/** 单次任务的容器：一个新引擎实例、一份日志、一个可选返回值。 */
interface Run<T> {
  engine: EngineInstance;
  value: T;
  /** 解析用日志（可能为空，配合 truncated 判断）。 */
  log: string;
  /** 报错用日志：始终只保留结尾。 */
  logTail: string;
  truncated: boolean;
}

async function withEngine<T>(
  factory: EngineFactory,
  options: Omit<EngineOptions, 'print' | 'printErr' | 'quit'>,
  body: (engine: EngineInstance) => T,
): Promise<Run<T>> {
  const log = new LogSink();
  const engine = await factory({
    ...options,
    print: (text) => log.write(text),
    printErr: (text) => log.write(text),
    // 引擎默认在错误时抛异常；改成看返回码，避免异常穿过 worker 边界。
    quit: () => {},
  });
  engine.FS.chdir('/');
  mkdirp(engine, WORK);
  engine.FS.chdir(WORK);
  const value = body(engine);
  return { engine, value, log: log.value, logTail: log.tail(), truncated: log.truncated };
}

/** 日志溢出时统一拒绝：解析结果不可信，必须整体失败而不是接着用。 */
function truncatedFailure(run: { truncated: boolean; logTail: string }): EngineFailure {
  const classified = classifyFailure(run.logTail);
  return new EngineFailure(
    'budget',
    '这次操作的输出太大，已经停止；请换更小或条目更少的压缩包',
    classified.code === 'engine' ? '' : run.logTail,
  );
}

/** 跑一次 callMain，把异常折成退出码（0 成功，非 0 失败）。 */
function callMain(engine: EngineInstance, args: string[]): number {
  try {
    const code = engine.callMain(args);
    return typeof code === 'number' ? code : 0;
  } catch (error) {
    return (error as { status?: number }).status ?? 2;
  }
}

function failure(log: string, fallback: string): EngineFailure {
  const classified = classifyFailure(log);
  const message = classified.code === 'engine' ? fallback : classified.message;
  return new EngineFailure(classified.code, message, tailOfLog(log, LOG_TAIL_LIMIT));
}

function splitBlocks(listing: string): Record<string, string>[] {
  const lines = listing.split(/\r?\n/);
  const separator = lines.findIndex((line) => /^-{4,}$/.test(line.trim()));
  if (separator < 0) return [];
  const blocks: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines.slice(separator + 1)) {
    if (line.trim().length === 0) {
      if (current && Object.keys(current).length > 0) blocks.push(current);
      current = null;
      continue;
    }
    const at = line.indexOf(' = ');
    if (at < 0) continue;
    current ??= {};
    current[line.slice(0, at).trim()] = line.slice(at + 3);
  }
  if (current && Object.keys(current).length > 0) blocks.push(current);
  return blocks;
}

const MODE_PATTERN = /^[-dlrwxstST]{6,}$/;

/**
 * 条目大小必须是安全的非负整数。返回 null 表示字段缺失或格式不对，
 * 调用方要把该条目标成不可信：拿 NaN/Infinity/负数去算预算会算出假结果。
 */
function parseSize(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim().length === 0) return null;
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/** Attributes 里的权限字段，用来补 7z 清单里缺的目录/链接判断。 */
function modeField(block: Record<string, string>): string | undefined {
  for (const field of (block['Attributes'] ?? '').trim().split(/\s+/)) {
    if (MODE_PATTERN.test(field)) return field;
  }
  return undefined;
}

function linkReason(block: Record<string, string>): string | undefined {
  if ((block['Symbolic Link'] ?? '').trim().length > 0) return '符号链接';
  if ((block['Hard Link'] ?? '').trim().length > 0) return '硬链接';
  if (modeField(block)?.startsWith('l')) return '符号链接';
  return undefined;
}

/**
 * 7z 的 `l -slt` 不会给目录打 Folder 标记，只在 Attributes 里写 'D'，
 * 所以要两处一起看，否则目录会被当成 0 字节的文件。
 */
function isFolderBlock(block: Record<string, string>): boolean {
  if ((block.Folder ?? '').trim() === '+') return true;
  return modeField(block)?.startsWith('d') ?? false;
}

/**
 * 解析 `l -slt` 的 key=value 块。第一块描述归档自身（带 Type 字段），要跳过。
 *
 * 7-Zip 会把条目名字段里的换行印成下划线，于是 -i@ 再也匹配不上那个条目；
 * 这类名字在主线程选中后必然失败，所以在这里先标成不安全。
 */
export function parseListing(listing: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  for (const block of splitBlocks(listing)) {
    if (block.Type !== undefined) continue;
    const raw = block.Path ?? '';
    if (raw.length === 0) continue;
    const name = raw.replace(/\/+$/, '');
    if (name.length === 0) continue;
    const folder = isFolderBlock(block);
    const size = parseSize(block.Size);
    // Packed Size 在 solid 块里对块内成员是空的（值只写在块的头部），
    // 这里只保证它是安全整数，不因为缺字段就判定条目不可用。
    const packedSize = parseSize(block['Packed Size']) ?? 0;
    const link = linkReason(block);
    const verdict = normalizeEntryName(name);
    const reasons = [
      verdict.ok ? null : verdict.reason,
      link ? `含${link}` : null,
      // 目录条目可以没有大小；文件条目缺少可信大小时不能当成 0 字节。
      size === null && !folder ? '条目大小无法识别' : null,
    ].filter((reason): reason is string => reason !== null);
    const parsed: ArchiveEntry = {
      name,
      folder,
      size: size ?? 0,
      packedSize,
      encrypted: (block.Encrypted ?? '').trim() === '+',
      link: link !== undefined,
    };
    // 安全条目不写 unsafe 字段，消息里也就不会带一个无意义的 undefined。
    if (reasons.length > 0) parsed.unsafe = reasons.join('，');
    entries.push(parsed);
  }
  return entries;
}

export interface InspectResult {
  entries: ArchiveEntry[];
  summary: Summary;
  /** 清单里带加密标记的条目数；大于 0 时提示可能需要口令。 */
  encryptedNames: number;
}

async function inspectOnce(
  factory: EngineFactory,
  options: Omit<EngineOptions, 'print' | 'printErr' | 'quit'>,
  archive: Uint8Array,
  password: string,
  limits: Limits,
): Promise<InspectResult> {
  const run = await withEngine(factory, options, (engine) => {
    engine.FS.writeFile(ARCHIVE, archive);
    const args = ['l', '-slt', ARCHIVE];
    // 口令只出现在参数数组里，不进 shell，也不会被打印。
    if (password.length > 0) args.push(`-p${password}`);
    return callMain(engine, args);
  });
  // 清单要完整才可信：先看退出码，再看日志有没有被截断。
  if (run.value !== 0)
    throw failure(
      run.logTail,
      '无法读取这个压缩包：它可能已损坏或口令不正确。确认口令后请重新选择文件。',
    );
  if (run.truncated) throw truncatedFailure(run);
  const entries = parseListing(run.log);
  if (entries.length === 0) throw failure(run.logTail, '这个压缩包里没有可列出的条目');
  const summary = summarize(entries);
  if (summary.files + summary.folders > limits.entries)
    throw new EngineFailure('budget', `条目数超过上限（${limits.entries} 个）`);
  if (summary.totalBytes > limits.expandedBytes)
    throw new EngineFailure('budget', '声明的展开总量超过上限，已停止');
  return { entries, summary, encryptedNames: entries.filter((entry) => entry.encrypted).length };
}

interface SandboxContents {
  files: Array<{ name: string; bytes: Uint8Array }>;
  directories: string[];
  /** 实际读出的字节总数，用来核对展开量预算。 */
  bytes: number;
}

/**
 * 遍历解压沙箱。这里边读边按真实字节数核对预算：清单里声明的大小是压缩包
 * 自己写的，不能当作实际展开量的证据。遇到链接直接失败，不把链接当文件读。
 */
function walkSandbox(
  engine: EngineInstance,
  path: string,
  prefix: string,
  out: SandboxContents,
  limits: Limits,
): void {
  for (const name of engine.FS.readdir(path)) {
    if (name === '.' || name === '..') continue;
    const child = `${path}/${name}`;
    const info = engine.FS.lstat(child);
    if (engine.FS.isLink(info.mode))
      throw new EngineFailure('unsafe', '解压结果里出现了符号链接，已停止');
    if (out.files.length + out.directories.length + 1 > limits.entries)
      throw new EngineFailure('budget', `解出的条目数超过上限（${limits.entries} 个），已停止`);
    if (engine.FS.isDir(info.mode)) {
      out.directories.push(prefix + name);
      walkSandbox(engine, child, `${prefix}${name}/`, out, limits);
      continue;
    }
    if (
      !Number.isSafeInteger(info.size) ||
      info.size < 0 ||
      out.bytes + info.size > limits.expandedBytes
    )
      throw new EngineFailure('budget', '实际解出的数据量超过上限，已停止');
    const bytes = engine.FS.readFile(child);
    out.bytes += bytes.length;
    out.files.push({ name: prefix + name, bytes });
  }
}

async function extractOnce(
  factory: EngineFactory,
  options: Omit<EngineOptions, 'print' | 'printErr' | 'quit'>,
  archive: Uint8Array,
  password: string,
  plan: ExtractPlan,
  limits: Limits,
): Promise<SandboxContents> {
  // An empty include list must never fall back to extracting the whole archive.
  if (plan.names.length === 0) return { files: [], directories: [...plan.directories], bytes: 0 };
  const run = await withEngine(factory, options, (engine) => {
    engine.FS.writeFile(ARCHIVE, archive);
    mkdirp(engine, SANDBOX);
    for (const dir of plan.directories) mkdirp(engine, `${SANDBOX}/${dir}`);
    // 选项文件逐行给出要取的条目名；名字已在主线程校验过，不含 CR/LF。
    engine.FS.writeFile(LIST_FILE, plan.names.map((name) => `${name}\n`).join(''));
    const args = ['x', ARCHIVE, `-o${SANDBOX}`, '-y', `-i@${LIST_FILE}`, '-spd'];
    if (password.length > 0) args.push(`-p${password}`);
    return callMain(engine, args);
  });
  // 非 0 退出码一律失败：即使磁盘上留了部分文件，也不能把半成品当成功。
  if (run.value !== 0) throw failure(run.logTail, '解压没有完成');
  if (run.truncated) throw truncatedFailure(run);
  const contents: SandboxContents = { files: [], directories: [], bytes: 0 };
  walkSandbox(run.engine, SANDBOX, '', contents, limits);
  if (contents.files.length === 0 && contents.directories.length === 0)
    throw failure(run.logTail, '没有解出任何条目，压缩包内可能使用了不规则的文件名');
  // 逐个核对：少一个条目就报失败，不能给出「看起来成功」的部分结果。
  const produced = new Set([...contents.files.map((file) => file.name), ...contents.directories]);
  for (const name of plan.names) {
    if (!produced.has(name)) throw new EngineFailure('engine', '有选中的条目没能解出，已停止');
  }
  // 实际字节数必须与清单里声明的一致，否则可能是被截断或损坏的内容。
  for (const file of contents.files) {
    const expected = plan.sizes[file.name];
    if (!Object.hasOwn(plan.sizes, file.name))
      throw new EngineFailure('unsafe', '解压结果包含未选中的文件，已停止');
    if (expected !== file.bytes.length)
      throw new EngineFailure('engine', '解出的内容和清单上的大小不一致，已停止');
  }
  return contents;
}

export interface CreateResult {
  bytes: Uint8Array;
  entries: number;
}

async function createOnce(
  factory: EngineFactory,
  options: Omit<EngineOptions, 'print' | 'printErr' | 'quit'>,
  format: 'zip' | '7z',
  level: Level,
  files: Array<{ name: string; bytes: Uint8Array }>,
  directories: string[],
  limits: Limits,
): Promise<CreateResult> {
  // 不信调用方声明的名字与大小：按真正的字节数重新核对一遍再交给引擎。
  const checked = checkCreateInputs(
    files.map((file) => ({ name: file.name, size: file.bytes.length })),
    directories,
    limits,
  );
  if (!checked.ok) throw new EngineFailure('budget', checked.reason);
  const actual = checked.files.reduce((sum, file) => sum + file.size, 0);
  // 空输入必须失败：7z 会「成功」地生成一个只有结束记录的 22 字节 zip，
  // 那种结果对用户没有意义，不能当成打包完成。
  if (files.length === 0 && directories.length === 0)
    throw new EngineFailure('engine', '还没有加入任何文件');
  if (actual > limits.inputBytes)
    throw new EngineFailure('budget', '待压缩的数据量超过上限，已停止');
  const run = await withEngine(factory, options, (engine) => {
    mkdirp(engine, SOURCE);
    for (const dir of directories) mkdirp(engine, `${SOURCE}/${dir}`);
    for (const file of files) {
      const target = `${SOURCE}/${file.name}`;
      mkdirp(engine, target.slice(0, target.lastIndexOf('/')));
      engine.FS.writeFile(target, file.bytes);
    }
    // 在源目录里用相对名打包：条目名保持原样，不会带上内部路径前缀。
    engine.FS.chdir(SOURCE);
    const args = [
      'a',
      OUTPUT,
      `-t${format}`,
      levelValue(level),
      '-y',
      '-spd',
      '--',
      ...directories,
      ...files.map((file) => file.name),
    ];
    return callMain(engine, args);
  });
  let bytes: Uint8Array | null = null;
  try {
    bytes = run.engine.FS.readFile(OUTPUT);
  } catch {
    bytes = null;
  }
  if (!bytes || bytes.length === 0 || run.value !== 0)
    throw failure(run.logTail, '打包没有完成，请减少文件后重试');
  if (run.truncated) throw truncatedFailure(run);
  return { bytes, entries: files.length + directories.length };
}

/**
 * 三种操作的对外入口。每次调用都新建引擎实例并在结束时丢弃，
 * 调用方（worker）只保留压缩包字节，因此不存在跨任务的临时文件。
 */
export class ArchiveEngine {
  constructor(
    private readonly factory: EngineFactory,
    private readonly options: Omit<EngineOptions, 'print' | 'printErr' | 'quit'>,
  ) {}

  inspect(archive: Uint8Array, password: string, limits: Limits): Promise<InspectResult> {
    return inspectOnce(this.factory, this.options, archive, password, limits);
  }

  extract(
    archive: Uint8Array,
    password: string,
    plan: ExtractPlan,
    limits: Limits,
  ): Promise<SandboxContents> {
    return extractOnce(this.factory, this.options, archive, password, plan, limits);
  }

  create(
    format: 'zip' | '7z',
    level: Level,
    files: Array<{ name: string; bytes: Uint8Array }>,
    directories: string[],
    limits: Limits,
  ): Promise<CreateResult> {
    return createOnce(this.factory, this.options, format, level, files, directories, limits);
  }
}
