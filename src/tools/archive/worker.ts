/**
 * 压缩工具的专用 module Worker：只有这里加载 7z-wasm 引擎，主站页面和
 * 构建脚本都不导入它。
 *
 * 引擎文件由构建原样复制到 lab-dist/tools/vendor/7z/，所以这里用运行时 URL
 * 动态 import（不让 Vite 解析这个包），再用 locateFile 指向同目录的 7zz.wasm。
 * 不需要 COOP/COEP：引擎走普通 fetch + instantiateStreaming。
 *
 * 生命周期：一个 worker 只服务一次任务，任务结束由主线程 terminate（见 client.ts），
 * 浏览器会连同 wasm 内存和引擎文件系统一起回收。这里**不保存任何跨任务状态**：
 * 每次请求都自带归档字节、口令与限额，因此下一个任务不可能看到上一个的残留。
 */

/// <reference lib="webworker" />

import { ArchiveEngine, type EngineFactory, type EngineOptions } from './engine';
import { checkCreateInputs, planExtraction } from './plan';
import { parseRequest, type WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let engineBase = '';
let factory: EngineFactory | null = null;

function send(message: WorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, transfer);
}

function toBytes(value: ArrayBufferView): Uint8Array {
  return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}

/** 独立副本：postMessage 之后主线程与 worker 都不该再改同一块内存。 */
function copyOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

function report(id: number, error: unknown): void {
  const failure = error as { code?: unknown; message?: unknown };
  if (typeof failure?.code === 'string' && typeof failure.message === 'string') {
    send({ type: 'failed', id, code: failure.code as never, message: failure.message });
    return;
  }
  send({ type: 'failed', id, code: 'engine', message: '压缩引擎没有完成这次操作' });
}

async function loadFactory(base: string): Promise<EngineFactory> {
  const module = (await import(/* @vite-ignore */ new URL('7zz.es6.js', base).href)) as {
    default?: unknown;
  };
  if (typeof module.default !== 'function') throw new Error('engine module has no factory');
  return module.default as EngineFactory;
}

function engineOptions(): Omit<EngineOptions, 'print' | 'printErr' | 'quit'> {
  // 引擎 JS 与 wasm 同目录，由构建一并复制。
  return { locateFile: (path) => new URL(path, engineBase).href };
}

async function ready(): Promise<ArchiveEngine> {
  factory ??= await loadFactory(engineBase);
  return new ArchiveEngine(factory, engineOptions());
}

async function handle(request: NonNullable<ReturnType<typeof parseRequest>>): Promise<void> {
  if (request.type === 'init') {
    engineBase = request.engineUrl.endsWith('/') ? request.engineUrl : `${request.engineUrl}/`;
    // 只登记引擎基址并回报就绪；真正的加载交给这次任务本身，
    // 避免 init 和紧随其后的任务并发跑两遍 ready()。
    send({ type: 'ready' });
    return;
  }
  try {
    const engine = await ready();
    switch (request.type) {
      case 'inspect': {
        send({ type: 'phase', id: request.id, phase: 'listing' });
        const archive = new Uint8Array(request.archive);
        const result = await engine.inspect(archive, request.password, request.limits);
        send({
          type: 'inspected',
          id: request.id,
          entries: result.entries,
          summary: result.summary,
          encryptedNames: result.encryptedNames,
        });
        return;
      }
      case 'extract': {
        const archive = new Uint8Array(request.archive);
        const password = request.password;
        // 重新做一遍预检：清单与限额都以这次真正拿到的归档为准，
        // 主线程给的 plan 只是「要哪些条目」的意图，执行的是这里重建的计划。
        send({ type: 'phase', id: request.id, phase: 'listing' });
        const inspected = await engine.inspect(archive, password, request.limits);
        // 只用用户最初选中的条目重做计划：names 只有文件，会丢掉选中的空目录。
        const planned = planExtraction(inspected.entries, request.plan.selected, request.limits);
        if (!planned.ok) {
          send({ type: 'failed', id: request.id, code: 'unsafe', message: planned.reason });
          return;
        }
        send({ type: 'phase', id: request.id, phase: 'extracting' });
        const contents = await engine.extract(archive, password, planned.plan, request.limits);
        const files = contents.files.map((file) => ({
          name: file.name,
          bytes: copyOf(file.bytes),
        }));
        send(
          { type: 'extracted', id: request.id, files, directories: contents.directories },
          files.map((file) => file.bytes),
        );
        return;
      }
      case 'create': {
        const files = request.files.map((file) => ({
          name: file.name,
          bytes: toBytes(new Uint8Array(file.bytes)),
        }));
        // 不信主线程声明的大小：按真实 buffer 字节数先过一遍录入检查。
        const checked = checkCreateInputs(
          files.map((file) => ({ name: file.name, size: file.bytes.length })),
          request.directories,
          request.limits,
        );
        if (!checked.ok) {
          send({ type: 'failed', id: request.id, code: 'budget', message: checked.reason });
          return;
        }
        send({ type: 'phase', id: request.id, phase: 'packing' });
        const result = await engine.create(
          request.format,
          request.level,
          files,
          request.directories,
          request.limits,
        );
        const bytes = copyOf(result.bytes);
        send({ type: 'created', id: request.id, bytes, entries: result.entries }, [bytes]);
        return;
      }
    }
  } catch (error) {
    report(request.id, error);
  }
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = parseRequest(event.data);
  if (!request) return;
  void handle(request);
});
