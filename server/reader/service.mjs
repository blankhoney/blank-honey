import { parseFeed } from './feeds.mjs';
import { createFeedFetcher, validateFeedUrl } from './fetch.mjs';
import { LIMITS, ReaderError } from './model.mjs';

export function createReaderService({
  store,
  fetchFeed = createFeedFetcher(),
  now = Date.now,
  timers = { setInterval, clearInterval },
  onError = () => {},
}) {
  const pending = new Map();
  let active = null;
  let running = null;
  let timer = null;
  let stopped = false;

  function report(sourceId, code) {
    // Callers receive only bounded metadata, never error messages, URLs or feed bodies.
    try {
      Promise.resolve(onError({ sourceId, code })).catch(() => {});
    } catch {
      /* Logging cannot own the scheduler. */
    }
  }

  async function drain() {
    while (!stopped && pending.size) {
      const [id, force] = pending.entries().next().value;
      pending.delete(id);
      let source;
      try {
        source = store.claimSource(id, now(), force);
      } catch {
        report(id, 'STORE_UNAVAILABLE');
        continue;
      }
      if (!source) continue;
      const controller = new AbortController();
      active = { id, controller };
      try {
        const result = await fetchFeed(source.feedUrl, {
          signal: controller.signal,
          etag: source.etag,
          lastModified: source.lastModified,
        });
        controller.signal.throwIfAborted();
        const feed = result.notModified ? undefined : parseFeed(result.xml, result.url);
        store.completeSource(
          id,
          source.leaseToken,
          {
            feed,
            notModified: result.notModified,
            etag: result.etag,
            lastModified: result.lastModified,
          },
          now(),
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          const code =
            error instanceof ReaderError && /^[A-Z_]{1,40}$/.test(error.code)
              ? error.code
              : 'FETCH_FAILED';
          try {
            store.failSource(
              id,
              source.leaseToken,
              { code, retryAfterMs: error?.retryAfterMs },
              now(),
            );
          } catch {
            report(id, 'STORE_UNAVAILABLE');
          }
          report(id, code);
        }
      } finally {
        try {
          store.releaseSource(id, source.leaseToken);
        } catch {
          report(id, 'STORE_UNAVAILABLE');
        }
        active = null;
      }
    }
  }

  function pump() {
    if (running || stopped || !pending.size) return;
    // Start in a microtask so running is installed before any synchronous empty drain completes.
    running = Promise.resolve()
      .then(drain)
      .catch(() => report(null, 'SCHEDULER_FAILED'))
      .finally(() => {
        running = null;
        if (pending.size && !stopped) pump();
      });
  }

  function enqueue(id, force = false) {
    if (stopped) throw new ReaderError('READER_UNAVAILABLE', 503);
    if (active?.id === id && !active.controller.signal.aborted) return;
    if (!pending.has(id) && pending.size >= LIMITS.sources)
      throw new ReaderError('QUEUE_FULL', 503);
    pending.set(id, Boolean(force || pending.get(id)));
    pump();
  }

  function scan() {
    if (stopped) return;
    try {
      for (const source of store.dueSources(now())) enqueue(source.id);
      store.cleanupSessions(now());
    } catch {
      report(null, 'STORE_UNAVAILABLE');
    }
  }

  function start() {
    if (timer !== null || stopped) return;
    scan();
    timer = timers.setInterval(scan, 30_000);
    timer?.unref?.();
  }

  function cancel(id) {
    pending.delete(id);
    if (active?.id === id) active.controller.abort();
  }

  function requireRunning() {
    if (stopped) throw new ReaderError('READER_UNAVAILABLE', 503);
  }

  function addSource(input) {
    requireRunning();
    const feedUrl = validateFeedUrl(input.feedUrl).href;
    const source = store.addSource({ feedUrl, title: input.title }, now());
    enqueue(source.id, true);
    return source.id;
  }

  function updateSource(id, patch) {
    requireRunning();
    const source = store.updateSource(id, patch, now());
    if (Object.hasOwn(patch, 'enabled')) {
      cancel(id);
      if (source.enabled) enqueue(id, true);
    }
    return id;
  }

  function deleteSource(id) {
    requireRunning();
    if (!store.getSource(id)) throw new ReaderError('NOT_FOUND', 404);
    store.deleteSource(id);
    cancel(id);
  }

  function clearEntries(id) {
    requireRunning();
    store.clearEntries(id, now());
    cancel(id);
    if (store.getSource(id)?.enabled) enqueue(id, true);
  }

  function refresh(id) {
    requireRunning();
    const source = store.getSource(id);
    if (!source) throw new ReaderError('NOT_FOUND', 404);
    if (!source.enabled) throw new ReaderError('SOURCE_PAUSED', 409);
    enqueue(id, true);
  }

  async function idle() {
    while (running) await running;
  }

  async function stop() {
    stopped = true;
    if (timer !== null) timers.clearInterval(timer);
    timer = null;
    pending.clear();
    active?.controller.abort();
    await idle();
  }

  return { start, scan, idle, stop, addSource, updateSource, deleteSource, clearEntries, refresh };
}
