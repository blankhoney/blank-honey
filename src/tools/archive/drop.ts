/**
 * 目录拖入时的条目展开：把 DataTransfer 里的 FileSystemEntry 树读成
 * 「规范化相对路径 + File」的扁平清单，交给 plan.ts 的 checkCreateInputs 继续判断。
 *
 * 这里不引用 DOM 事件、Worker 或 7z-wasm，条目参数用结构类型描述，
 * 方便在 Node 上用假条目直接跑单元测试。
 *
 * 三条纪律：
 * 1. 顺序读取（不并发）：拖入的目录可能很大，逐条 await 才能让取消立刻生效，
 *    也避免一次性把整棵树读进内存。
 * 2. 预算前置：条目数（含目录自身）与文件实际字节数在读取途中就累计并拒绝，
 *    不等读完整棵树。
 * 3. 不吞异常：file()/readEntries 的错误原样 reject 给调用方（UI 那里统一提示），
 *    取消则抛固定的中文错误。
 */

import { normalizeEntryName, type Limits } from './plan';

/** 展开结果：file 为 null 只表示空目录，非空目录不会作为一个条目出现。 */
export type DroppedItem = { name: string; file: File | null };

const CANCEL_MESSAGE = '已取消目录读取';
const UNSUPPORTED_MESSAGE = '不支持这个目录条目';

/**
 * 把一组顶层条目读成扁平清单。prefix 由递归维护，父目录路径随子条目的名字自然保留。
 *
 * @param entries 顶层条目（drop 事件里同步取出的那些）。
 * @param limits 预算：条目数上限与输入字节上限。
 * @param active 取消探针：返回 false 时立即抛错，不再继续读。
 */
export async function readDroppedEntries(
  entries: FileSystemEntry[],
  limits: Limits,
  active: () => boolean,
): Promise<DroppedItem[]> {
  const result: DroppedItem[] = [];
  // 目录本身也算一个条目，和 checkCreateInputs 的口径一致。
  let visited = 0;
  let totalBytes = 0;

  const visit = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (!active()) throw new Error(CANCEL_MESSAGE);
    visited += 1;
    if (visited > limits.entries)
      throw new Error(`目录里的条目数超过上限（${limits.entries} 个），已停止`);
    // 条目名里出现分隔符就无法拼出可信的相对路径，先挡住再交给 normalizeEntryName。
    if (entry.name.includes('/') || entry.name.includes('\\'))
      throw new Error('条目名称不安全：名称包含路径分隔符');
    const verdict = normalizeEntryName(prefix + entry.name);
    if (!verdict.ok) throw new Error(`条目名称不安全：${verdict.reason}`);
    const name = verdict.name;

    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      if (!active()) throw new Error(CANCEL_MESSAGE);
      totalBytes += file.size;
      if (totalBytes > limits.inputBytes)
        throw new Error(
          `待压缩总量超过上限（${Math.round(limits.inputBytes / (1024 * 1024))} MiB），已停止`,
        );
      result.push({ name, file });
      return;
    }

    if (!entry.isDirectory) throw new Error(UNSUPPORTED_MESSAGE);

    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!active()) throw new Error(CANCEL_MESSAGE);
      if (batch.length === 0) break;
      children.push(...batch);
      // 单目录的暂存也要挡住：后面每个孩子都会各占一个名额。
      if (visited + children.length > limits.entries)
        throw new Error(`目录里的条目数超过上限（${limits.entries} 个），已停止`);
    }

    if (children.length === 0) {
      result.push({ name, file: null });
      return;
    }
    for (const child of children) await visit(child, `${name}/`);
  };

  for (const entry of entries) await visit(entry, '');
  return result;
}
