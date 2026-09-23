export type PreloadableHero = { preload?: (signal: AbortSignal) => Promise<void> };

export type HeroPreloadPolicy = {
  reduced: boolean;
  hidden: boolean;
  online?: boolean;
  saveData?: boolean;
  effectiveType?: string;
};

/** This gates speculation, never the resources needed for an actual selection. */
export function canPreloadHero(policy: HeroPreloadPolicy): boolean {
  return (
    !policy.reduced &&
    !policy.hidden &&
    policy.online !== false &&
    !policy.saveData &&
    !['slow-2g', '2g', '3g'].includes(policy.effectiveType ?? '')
  );
}

type Environment = {
  allowed(): boolean;
  /** Schedule asynchronously; the returned function cancels a still-pending callback. */
  idle(callback: () => void): () => void;
};

type Page = {
  signal: AbortSignal;
  current?: { id: string; signal: AbortSignal };
  ready: boolean;
  next?: string;
  cancelIdle?: () => void;
  disposed: boolean;
};

type Request = { page: Page; id: string; intent: boolean };
type Job = Request & { controller: AbortController };

function aborted(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}

/**
 * One coordinator per document, including across Astro page swaps. A speculative import keeps
 * its slot until it settles: aborting its owner cannot cancel import(), or justify starting a
 * second speculative download. Nothing here calls an effect's mount function or creates a canvas.
 */
export function createHeroPreloader<T extends PreloadableHero>(
  load: (id: string) => Promise<T>,
  environment: Environment,
) {
  const modules = new Map<string, Promise<T>>();
  let owner: Page | undefined;
  let running: Job | undefined;
  let queued: Request | undefined;

  function moduleFor(id: string): Promise<T> {
    let pending = modules.get(id);
    if (!pending) {
      const attempt = Promise.resolve()
        .then(() => load(id))
        .catch((error: unknown) => {
          if (modules.get(id) === attempt) modules.delete(id);
          throw error;
        });
      modules.set(id, attempt);
      pending = attempt;
    }
    return pending;
  }

  function owns(page: Page): boolean {
    return owner === page && !page.disposed && !page.signal.aborted;
  }

  function cancelIdle(page: Page) {
    page.cancelIdle?.();
    page.cancelIdle = undefined;
  }

  function pause(page: Page) {
    cancelIdle(page);
    if (queued?.page === page) queued = undefined;
    if (running?.page === page) running.controller.abort();
  }

  function dispose(page: Page) {
    if (page.disposed) return;
    page.disposed = true;
    pause(page);
    if (owner === page) owner = undefined;
  }

  function pump() {
    if (running || !queued) return;
    const request = queued;
    if (!owns(request.page) || !environment.allowed()) {
      queued = undefined;
      return;
    }
    if (!request.page.ready) return;
    queued = undefined;
    if (request.page.current?.id === request.id) return;
    const job: Job = { ...request, controller: new AbortController() };
    running = job;
    void (async () => {
      try {
        const module = await moduleFor(job.id);
        if (job.controller.signal.aborted || !owns(job.page) || !environment.allowed()) return;
        // The preload contract waits for all imports it started, even when its data fetch aborts.
        await module.preload?.(job.controller.signal);
      } catch {
        // Speculation is optional. A real selection can retry and owns its normal error report.
      } finally {
        if (running === job) running = undefined;
        pump();
      }
    })();
  }

  function enqueue(page: Page, id: string, intent: boolean) {
    if (!owns(page) || !environment.allowed() || page.current?.id === id) return;
    if (intent) cancelIdle(page);
    if (running?.page === page && running.id === id && !running.controller.signal.aborted) {
      if (intent) {
        running.intent = true;
        queued = undefined;
      }
      return;
    }
    // An automatic neighbour must not displace a button the person is already pointing at.
    if (!intent && (queued?.intent || (running?.intent && !running.controller.signal.aborted)))
      return;
    queued = { page, id, intent };
    running?.controller.abort();
    pump();
  }

  function scheduleNext(page: Page) {
    cancelIdle(page);
    if (!owns(page) || !page.ready || !page.next || !environment.allowed()) return;
    page.cancelIdle = environment.idle(() => {
      page.cancelIdle = undefined;
      if (page.next) enqueue(page, page.next, false);
    });
  }

  return {
    attach(signal: AbortSignal) {
      if (owner) dispose(owner);
      const page: Page = { signal, ready: false, disposed: false };
      owner = page;
      const onAbort = () => dispose(page);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) dispose(page);

      return {
        async loadCurrent(id: string, active: AbortSignal, reduced: boolean): Promise<T> {
          if (!owns(page) || active.aborted) throw aborted(active.aborted ? active : signal);
          cancelIdle(page);
          if (queued?.page === page) queued = undefined;
          page.current = { id, signal: active };
          page.ready = false;
          page.next = undefined;
          // Keep a matching prefetch alive until the real consumer has acquired its data lease.
          if (running && (running.id !== id || reduced)) running.controller.abort();
          const module = await moduleFor(id);
          if (!owns(page) || active.aborted || page.current.signal !== active)
            throw aborted(active.aborted ? active : signal);
          if (!reduced) {
            try {
              // Invoke synchronously so an asset consumer is registered before promotion aborts
              // the speculative consumer. Do not await this: mount can already show its fallback.
              const preparation = module.preload?.(active);
              void preparation?.catch(() => {});
            } catch {
              // The actual mount, not optional preparation, reports a failure to the user.
            }
          }
          if (running?.id === id) running.controller.abort();
          return module;
        },
        ready(active: AbortSignal, next: string) {
          if (!owns(page) || active.aborted || page.current?.signal !== active) return;
          page.ready = true;
          page.next = next;
          pump();
          scheduleNext(page);
        },
        intent(id: string) {
          enqueue(page, id, true);
        },
        refresh() {
          if (!owns(page)) return;
          if (!environment.allowed()) pause(page);
          else {
            pump();
            scheduleNext(page);
          }
        },
        dispose() {
          signal.removeEventListener('abort', onAbort);
          dispose(page);
        },
      };
    },
  };
}
