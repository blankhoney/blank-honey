/**
 * 页面与 worker 之间的调度层：worker 生命周期、任务 id、超时与取消。
 *
 * 每次操作都开一个独立的 worker，操作结束（成功、失败、取消、超时）一律
 * terminate 掉。浏览器会连 wasm 内存和引擎文件系统一起回收，所以不需要在
 * worker 内部写清理逻辑，上一个任务的残留也不可能影响下一个文件。
 *
 * epoch 用来挡住「取消之后旧任务又回来」的情况：取消/清空会 ++epoch，
 * 异步读盘之前记下当时的 epoch，读完发现变了就直接放弃，不会再去起新 worker。
 */

import { parseResponse, type OutputFile, type Phase, type WorkerResponse } from './protocol';
import type { ArchiveEntry, ExtractPlan, Level, Limits, Summary } from './plan';
import { timeoutMsFor } from './plan';

export interface InspectResult {
  entries: ArchiveEntry[];
  summary: Summary;
  encryptedNames: number;
}

export interface ExtractResult {
  files: OutputFile[];
  directories: string[];
}

export interface CreateResult {
  bytes: ArrayBuffer;
  entries: number;
}

export interface ClientEvents {
  phase?(phase: Phase): void;
}

export class ArchiveError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** 一次任务：一个 worker、一个待决的请求、一个看门狗。 */
class Task<T> {
  private readonly worker: Worker;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private settled = false;

  constructor(
    private readonly id: number,
    timeoutMs: number,
    private readonly events: ClientEvents,
    engineUrl: string,
    private readonly settle: (value: T | Error) => void,
  ) {
    // Vite 负责把 worker.ts 及其依赖打成一个 module worker。
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event) => this.handle(event));
    this.worker.addEventListener('error', () => {
      this.finish(new ArchiveError('engine', '压缩引擎中断了，请重试'));
    });
    this.worker.postMessage({ type: 'init', engineUrl });
    this.timer = setTimeout(() => {
      this.finish(new ArchiveError('timeout', '这个文件处理太久，已经停止'));
    }, timeoutMs);
  }

  private handle(event: MessageEvent<unknown>): void {
    const message = parseResponse(event.data);
    if (!message) return;
    if (message.type === 'ready' || message.id !== this.id) return;
    if (message.type === 'phase') {
      this.events.phase?.(message.phase);
      return;
    }
    if (message.type === 'failed') {
      this.finish(new ArchiveError(message.code, message.message));
      return;
    }
    this.finish(message as T);
  }

  private finish(value: T | Error): void {
    if (this.settled) return;
    this.settled = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.worker.terminate();
    this.settle(value);
  }

  post(message: Record<string, unknown>, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }

  cancel(message: string): void {
    this.finish(new ArchiveError('cancelled', message));
  }

  /** 构造失败或 post 抛错时用：结束任务但不必再终止一个没建成的 worker。 */
  abandon(error: Error): void {
    this.finish(error);
  }
}

export class ArchiveClient {
  private running: Task<WorkerResponse> | null = null;
  private nextId = 1;
  /** 取消/清空会 +1；异步读盘前后对比它来判断结果是否已经过期。 */
  private epoch = 0;

  constructor(
    private readonly engineUrl: string,
    private readonly events: ClientEvents = {},
  ) {}

  private run<T>(
    timeoutMs: number,
    build: (id: number) => { message: Record<string, unknown>; transfer?: Transferable[] },
  ): Promise<T> {
    if (this.running) return Promise.reject(new ArchiveError('engine', '上一个操作还没结束'));
    const id = this.nextId++;
    let task: Task<WorkerResponse> | null = null;
    return new Promise<WorkerResponse>((resolve, reject) => {
      const settle = (value: WorkerResponse | Error): void => {
        this.running = null;
        if (value instanceof Error) reject(value);
        else resolve(value);
      };
      try {
        // worker 构造、参数拼装和 post 都可能抛错，任何一步都不能留着一个
        // 悬着的 running 状态等到看门狗才清理。
        task = new Task<WorkerResponse>(id, timeoutMs, this.events, this.engineUrl, settle);
        this.running = task;
        const { message, transfer } = build(id);
        task.post(message, transfer);
      } catch (error) {
        this.running = null;
        task?.abandon(error instanceof Error ? error : new ArchiveError('engine', '操作没能开始'));
      }
    }).then((response) => this.unwrap<T>(response));
  }

  private unwrap<T>(response: WorkerResponse): T {
    if (response.type === 'failed') throw new ArchiveError(response.code, response.message);
    return response as T;
  }

  /** 读盘前后对比 epoch：取消/清空之后回来的旧结果必须被丢弃。 */
  private async readArchive(file: File): Promise<ArrayBuffer> {
    const epoch = this.epoch;
    const bytes = await file.arrayBuffer();
    if (epoch !== this.epoch) throw new ArchiveError('cancelled', '已取消这次操作');
    return bytes;
  }

  async inspect(file: File, password: string, limits: Limits): Promise<InspectResult> {
    const archive = await this.readArchive(file);
    const response = await this.run<Extract<WorkerResponse, { type: 'inspected' }>>(
      timeoutMsFor(archive.byteLength),
      (id) => ({ message: { type: 'inspect', id, archive, password, limits } }),
    );
    return {
      entries: response.entries,
      summary: response.summary,
      encryptedNames: response.encryptedNames,
    };
  }

  async extract(
    file: File,
    password: string,
    plan: ExtractPlan,
    limits: Limits,
  ): Promise<ExtractResult> {
    const archive = await this.readArchive(file);
    const response = await this.run<Extract<WorkerResponse, { type: 'extracted' }>>(
      timeoutMsFor(archive.byteLength) + 10_000,
      (id) => ({ message: { type: 'extract', id, plan, archive, password, limits } }),
    );
    return { files: response.files, directories: response.directories };
  }

  async create(
    format: 'zip' | '7z',
    level: Level,
    files: Array<{ name: string; bytes: ArrayBuffer }>,
    directoryNames: string[],
    totalBytes: number,
    limits: Limits,
  ): Promise<CreateResult> {
    const response = await this.run<Extract<WorkerResponse, { type: 'created' }>>(
      timeoutMsFor(totalBytes) + 10_000,
      (id) => ({
        message: { type: 'create', id, format, level, files, directories: directoryNames, limits },
      }),
    );
    return { bytes: response.bytes, entries: response.entries };
  }

  /** 取消当前操作：terminate 后状态立即回到空闲，可以继续换文件再试。 */
  cancel(): void {
    this.epoch += 1;
    this.running?.cancel('已取消这次操作');
    this.running = null;
  }

  dispose(): void {
    this.epoch += 1;
    this.running?.cancel('页面已关闭');
    this.running = null;
  }
}
