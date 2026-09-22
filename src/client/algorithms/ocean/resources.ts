export type Disposable = { dispose(): void };

export type ResourceSet = {
  /** Tracks a resource so it is released if construction fails or dispose runs. */
  add<T extends Disposable>(item: T): T;
  dispose(): void;
  readonly disposed: boolean;
};

/**
 * Releases GPU resources in reverse creation order, tolerating a disposable
 * that throws so one failure cannot strand the rest. Every owner in this
 * feature builds its objects through a set: a partially initialised scene must
 * free whatever it already allocated, and `dispose` must be safe to call twice.
 */
export function resourceSet(): ResourceSet {
  const items: Disposable[] = [];
  let disposed = false;
  return {
    add<T extends Disposable>(item: T): T {
      if (disposed) {
        item.dispose();
        return item;
      }
      items.push(item);
      return item;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item) continue;
        try {
          item.dispose();
        } catch {
          // Keep releasing; a single bad resource must not strand the others.
        }
      }
      items.length = 0;
    },
    get disposed() {
      return disposed;
    },
  };
}
