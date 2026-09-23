import assert from 'node:assert/strict';
import { setImmediate as settle } from 'node:timers/promises';
import test from 'node:test';

import {
  canPreloadHero,
  createHeroPreloader,
  type HeroPreloadPolicy,
} from '../src/client/hero-preload';

/**
 * CPU-side contract checks for the hero preload coordinator: which requests the policy allows, how
 * a speculative import shares its slot with a real selection, and what a page swap does to work
 * that is already in flight. Every import is an in-memory fake that resolves and rejects on demand,
 * the idle queue is fake, and the gate is the real `canPreloadHero` predicate. No DOM, canvas, GPU
 * context, timer or network is involved, so a green run proves the coordination rules — never that
 * a browser downloaded a chunk or that a GPU did anything.
 */

type Preload = (signal: AbortSignal) => Promise<void>;

type FakeModule = {
  /** Counted, never expected to run here: the coordinator must not mount anything. */
  default: () => void;
  createScene: () => void;
  getContext: () => void;
  preload?: Preload;
};

type ModuleOptions = {
  /** `null` builds a module with no `preload` at all, like a metadata-only chunk. */
  preload?: Preload | null;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((settlePromise, failPromise) => {
    resolve = settlePromise;
    reject = failPromise;
  });
  return { promise, resolve, reject };
}

/** Drains the microtask queue the coordinator starts its imports on. Never a real wait. */
async function flush(): Promise<void> {
  await settle();
  await settle();
}

function neverSettles(): Promise<void> {
  return new Promise<void>(() => {});
}

/** The fake `load(id)` a page would hand to the coordinator, with every import under test control. */
function createHarness() {
  const calls: string[] = [];
  const attempts: { id: string; deferred: Deferred<FakeModule> }[] = [];
  const preloads: { id: string; signal: AbortSignal; abortedAtEntry: boolean }[] = [];
  const mounts: string[] = [];
  const sceneCalls: string[] = [];
  const contextCalls: string[] = [];

  const load = (id: string): Promise<FakeModule> => {
    calls.push(id);
    const deferred = defer<FakeModule>();
    attempts.push({ id, deferred });
    return deferred.promise;
  };

  const moduleFor = (id: string, options: ModuleOptions = {}): FakeModule => {
    const module: FakeModule = {
      default: () => {
        mounts.push(id);
      },
      createScene: () => {
        sceneCalls.push(id);
      },
      getContext: () => {
        contextCalls.push(id);
      },
    };
    const custom = options.preload;
    if (custom !== null) {
      module.preload = (signal: AbortSignal) => {
        preloads.push({ id, signal, abortedAtEntry: signal.aborted });
        return custom ? custom(signal) : Promise.resolve();
      };
    }
    return module;
  };

  /** The newest import of `id`, which is the one a resolver can still settle. */
  const attemptFor = (id: string) => {
    const matching = attempts.filter((attempt) => attempt.id === id);
    const attempt = matching[matching.length - 1];
    assert.ok(attempt, `${id}: no import has been requested yet`);
    return attempt.deferred;
  };

  return {
    load,
    moduleFor,
    calls,
    preloads,
    mounts,
    sceneCalls,
    contextCalls,
    resolve: (id: string, module: FakeModule) => attemptFor(id).resolve(module),
    reject: (id: string, error: unknown) => attemptFor(id).reject(error),
    loadCount: (id: string) => calls.filter((call) => call === id).length,
    preloadCount: (id: string) => preloads.filter((event) => event.id === id).length,
    preloadSignal: (id: string, index = 0) => {
      const event = preloads.filter((candidate) => candidate.id === id)[index];
      assert.ok(event, `${id}: preparation number ${index} has not been requested yet`);
      return event.signal;
    },
  };
}

type Harness = ReturnType<typeof createHarness>;

/** A fake idle queue that can fire a callback even after it was cancelled, as a real one may race. */
function createIdleQueue() {
  const scheduled: { callback: () => void; cancelled: boolean; fired: boolean }[] = [];
  let cancellations = 0;
  return {
    scheduled,
    cancellations: () => cancellations,
    /** Callbacks still waiting: not cancelled and not delivered. */
    pending: () => scheduled.filter((entry) => !entry.cancelled && !entry.fired).length,
    lastCancelled: () => {
      const entry = scheduled[scheduled.length - 1];
      assert.ok(entry, 'nothing is queued on the idle queue');
      return entry.cancelled;
    },
    schedule: (callback: () => void) => {
      const entry = { callback, cancelled: false, fired: false };
      scheduled.push(entry);
      return () => {
        entry.cancelled = true;
        cancellations += 1;
      };
    },
    fire: (index = scheduled.length - 1) => {
      const entry = scheduled[index];
      assert.ok(entry, 'nothing is queued on the idle queue');
      entry.fired = true;
      entry.callback();
    },
  };
}

/** The session API the coordinator documents, spelled out here so the tests read as the contract. */
type Session = {
  loadCurrent(id: string, active: AbortSignal, reduced: boolean): Promise<FakeModule>;
  ready(active: AbortSignal, next: string): void;
  intent(id: string): void;
  refresh(): void;
  dispose(): void;
};

type PageContext = { harness: Harness; session: Session; page: AbortController };

/**
 * The whole rig for one document: a mutable policy object, the idle queue, the coordinator and one
 * attached page whose signal doubles as the active selection signal unless a test says otherwise.
 */
function createRig(policy: HeroPreloadPolicy = { reduced: false, hidden: false }) {
  const harness = createHarness();
  const idle = createIdleQueue();
  const preloader = createHeroPreloader(harness.load, {
    // The real adapter is this predicate, so a weak-network policy is exercised through the same
    // gate a browser build gets.
    allowed: () => canPreloadHero(policy),
    idle: idle.schedule,
  });
  const page = new AbortController();
  const session: Session = preloader.attach(page.signal);
  return { harness, idle, policy, preloader, page, session };
}

type Rig = ReturnType<typeof createRig>;

function attachPage(rig: Rig): PageContext {
  const page = new AbortController();
  return { harness: rig.harness, session: rig.preloader.attach(page.signal), page };
}

/** A real selection, import settled: the way the page acquires its module. */
async function selectCurrent(
  context: PageContext,
  id: string,
  options: { reduced?: boolean; module?: FakeModule } = {},
): Promise<FakeModule> {
  const module = options.module ?? context.harness.moduleFor(id);
  const current = context.session.loadCurrent(id, context.page.signal, options.reduced ?? false);
  await flush();
  context.harness.resolve(id, module);
  assert.equal(await current, module, `${id}: the selection returns its own module`);
  return module;
}

/** Collects rejections that nobody handled while `run` executes. */
async function withoutUnhandledRejections(run: () => Promise<void>): Promise<void> {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    await run();
    await flush();
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
  assert.deepEqual(
    unhandled,
    [],
    'an optional preparation must not surface as an unhandled rejection',
  );
}

test('canPreloadHero refuses every weak-network or preference signal and allows a healthy one', () => {
  const healthy = { reduced: false, hidden: false };
  assert.equal(canPreloadHero(healthy), true, 'no signal at all allows speculation');
  assert.equal(canPreloadHero({ ...healthy, online: true, saveData: false }), true);
  assert.equal(canPreloadHero({ ...healthy, effectiveType: '4g' }), true);
  assert.equal(canPreloadHero({ ...healthy, effectiveType: '5g' }), true, 'unknown is not metered');

  assert.equal(canPreloadHero({ ...healthy, online: false }), false);
  assert.equal(canPreloadHero({ ...healthy, saveData: true }), false);
  assert.equal(canPreloadHero({ ...healthy, reduced: true }), false);
  assert.equal(canPreloadHero({ ...healthy, hidden: true }), false);
  for (const effectiveType of ['slow-2g', '2g', '3g']) {
    assert.equal(canPreloadHero({ ...healthy, effectiveType }), false, effectiveType);
  }
});

test('a current load queues no idle work: only ready() names the next entry', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  assert.deepEqual(rig.harness.calls, ['a']);
  assert.equal(rig.idle.pending(), 0, 'a selection alone must not schedule speculation');

  rig.session.ready(rig.page.signal, 'b');
  assert.equal(rig.idle.pending(), 1, 'ready() queues exactly one next entry');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('b', rig.harness.moduleFor('b'));
  await flush();

  assert.deepEqual(
    rig.harness.calls,
    ['a', 'b'],
    'the idle callback prefetches the next entry only',
  );
  assert.equal(rig.harness.preloadCount('b'), 1);
  assert.deepEqual(rig.harness.mounts, []);
});

test('a cancelled idle callback cannot prefetch anything after dispose', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  assert.equal(rig.idle.pending(), 1);
  assert.equal(rig.idle.cancellations(), 0);

  rig.session.dispose();
  assert.equal(rig.idle.cancellations(), 1, 'dispose cancels the pending idle callback');
  rig.idle.fire(); // the scheduler races and delivers the cancelled callback anyway
  await flush();
  assert.equal(rig.harness.loadCount('b'), 0);
});

test('a module without preload is imported for a real selection and for speculation, never mounted', async () => {
  const rig = createRig();
  const light = rig.harness.moduleFor('light', { preload: null });
  await selectCurrent(rig, 'light', { module: light });
  assert.equal(rig.harness.preloadCount('light'), 0);
  assert.deepEqual(rig.harness.mounts, []);

  rig.session.ready(rig.page.signal, 'neighbour');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('neighbour', rig.harness.moduleFor('neighbour', { preload: null }));
  await flush();
  assert.equal(rig.harness.loadCount('neighbour'), 1, 'the light chunk is still prefetched');
  assert.equal(rig.harness.preloadCount('neighbour'), 0);
  assert.deepEqual(rig.harness.mounts, []);
});

test('a real selection joins the in-flight import of the same id instead of starting a second one', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('b'), 1, 'the speculative import is in flight');

  rig.session.intent('b'); // pointing at the module the slot already holds
  await flush();
  assert.equal(
    rig.harness.loadCount('b'),
    1,
    'an intent on the running import adds no second import',
  );

  const active = new AbortController();
  const current = rig.session.loadCurrent('b', active.signal, false);
  await flush();
  assert.equal(rig.harness.loadCount('b'), 1, 'the selection reuses the same import promise');

  const moduleB = rig.harness.moduleFor('b');
  rig.harness.resolve('b', moduleB);
  assert.equal(await current, moduleB);
  await flush();
  assert.equal(rig.harness.preloadCount('b'), 2, 'the speculation and the consumer each prepare');
  assert.deepEqual(rig.harness.mounts, []);
});

test('a failed import is evicted so the next real selection retries it', async () => {
  const rig = createRig();
  const failure = new Error('chunk unavailable');
  const first = rig.session.loadCurrent('a', rig.page.signal, false);
  await flush();
  rig.harness.reject('a', failure);
  await assert.rejects(first, (error: unknown) => error === failure);
  assert.deepEqual(rig.harness.mounts, [], 'a failed import cannot mount');

  const second = rig.session.loadCurrent('a', rig.page.signal, false);
  await flush();
  assert.equal(rig.harness.loadCount('a'), 2, 'the rejected module is imported again');
  const moduleA = rig.harness.moduleFor('a');
  rig.harness.resolve('a', moduleA);
  assert.equal(await second, moduleA);
  assert.equal(rig.harness.preloadCount('a'), 1);
});

test('a rejected preparation never reaches the caller and never blocks later speculation', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');

  await withoutUnhandledRejections(async () => {
    rig.session.ready(rig.page.signal, 'b');
    rig.idle.fire();
    await flush();
    rig.harness.resolve(
      'b',
      rig.harness.moduleFor('b', {
        preload: () => Promise.reject(new Error('speculation failed')),
      }),
    );
    await flush();

    assert.equal(rig.harness.preloadCount('b'), 1);
    assert.equal(rig.harness.loadCount('c'), 0);

    rig.session.ready(rig.page.signal, 'c');
    rig.idle.fire();
    await flush();
    rig.harness.resolve('c', rig.harness.moduleFor('c'));
    await flush();
    assert.equal(rig.harness.loadCount('c'), 1, 'speculation continues after a failed preparation');

    const rejecting = rig.harness.moduleFor('d', {
      preload: () => Promise.reject(new Error('selection preparation failed')),
    });
    assert.equal(await selectCurrent(rig, 'd', { module: rejecting }), rejecting);
  });

  assert.deepEqual(rig.harness.mounts, []);
});

test('an explicit intent runs at once and cancels the idle neighbour', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  assert.equal(rig.idle.pending(), 1);

  rig.session.intent('b');
  assert.equal(rig.idle.cancellations(), 1, 'a pointed-at entry cancels the idle neighbour');
  await flush();
  assert.equal(rig.harness.loadCount('b'), 1, 'the intent imports without waiting for idle');

  rig.idle.fire(); // the cancelled neighbour callback races in while the import is in flight
  await flush();
  assert.equal(rig.harness.loadCount('b'), 1, 'an automatic neighbour cannot displace the intent');

  rig.harness.resolve('b', rig.harness.moduleFor('b'));
  await flush();
  assert.equal(rig.harness.preloadCount('b'), 1);
  assert.deepEqual(rig.harness.mounts, []);
});

test('intents made before ready keep only the newest one queued', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a'); // a current selection exists, but the page is not ready yet
  rig.session.intent('one');
  rig.session.intent('two');
  assert.equal(rig.harness.loadCount('one'), 0);
  assert.equal(rig.harness.loadCount('two'), 0, 'nothing imports before the page is ready');

  rig.session.ready(rig.page.signal, 'neighbour');
  await flush();
  assert.equal(rig.harness.loadCount('one'), 0, 'the displaced intent is dropped');
  assert.equal(rig.harness.loadCount('two'), 1);
  assert.equal(rig.harness.loadCount('neighbour'), 0, 'the intent outranks the idle neighbour');

  rig.harness.resolve('two', rig.harness.moduleFor('two'));
  await flush();
  assert.equal(rig.harness.preloadCount('two'), 1);
  assert.deepEqual(rig.harness.mounts, []);
});

test('an automatic neighbour cannot displace a queued explicit intent', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'slow');
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('slow'), 1, 'the speculative import is in flight');

  rig.session.intent('target');
  assert.equal(rig.harness.loadCount('target'), 0, 'the intent waits for the occupied slot');

  rig.session.ready(rig.page.signal, 'neighbour');
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('neighbour'), 0, 'the neighbour yields to the queued intent');
  assert.equal(rig.harness.loadCount('target'), 0, 'the slot is still held by the import');

  rig.harness.resolve('slow', rig.harness.moduleFor('slow'));
  await flush();
  assert.equal(rig.harness.loadCount('target'), 1, 'the intent starts as soon as the slot frees');
  assert.equal(rig.harness.loadCount('neighbour'), 0, 'the dropped neighbour stays dropped');
  assert.equal(rig.harness.preloadCount('slow'), 0, 'the aborted slot never prepared its module');
});

test('dispose aborts the speculative preparation signal', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('b', rig.harness.moduleFor('b', { preload: neverSettles }));
  await flush();
  const signal = rig.harness.preloadSignal('b');
  assert.equal(signal.aborted, false, 'the speculative preparation starts live');

  rig.session.dispose();
  assert.equal(signal.aborted, true, 'dispose releases the speculative preparation');
  assert.deepEqual(rig.harness.mounts, []);
});

test('aborting the page signal releases the speculative preparation', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('b', rig.harness.moduleFor('b', { preload: neverSettles }));
  await flush();
  const signal = rig.harness.preloadSignal('b');
  assert.equal(signal.aborted, false);

  rig.page.abort();
  assert.equal(signal.aborted, true, 'the page going away releases the speculative preparation');
});

test('a new attach disposes the previous page and its pending work', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  rig.idle.fire();
  await flush();
  const hero = rig.harness.moduleFor('b', { preload: neverSettles });
  rig.harness.resolve('b', hero);
  await flush();
  const signal = rig.harness.preloadSignal('b');
  assert.equal(signal.aborted, false);

  const next = attachPage(rig);
  assert.equal(signal.aborted, true, 'the swap releases the old page work');
  assert.equal(rig.harness.preloadCount('b'), 1);

  // The new page gets the very module the abandoned import already produced.
  assert.equal(await selectCurrent(next, 'b', { module: hero }), hero);
  assert.equal(rig.harness.mounts.length, 0);
});

test('an unsettled import keeps its slot across a page swap, and the foreground never waits for it', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'slow');
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('slow'), 1, 'the speculative import is in flight');

  const foregroundModule = rig.harness.moduleFor('b');
  const next = attachPage(rig); // the swap aborts the signal, never the import
  // This returns while `slow` is still unsettled, so the foreground never waited for the slot.
  await selectCurrent(next, 'b', { module: foregroundModule });
  assert.equal(rig.harness.loadCount('slow'), 1, 'the stale import is still unsettled');
  assert.equal(rig.harness.preloadCount('b'), 1);

  next.session.ready(next.page.signal, 'other');
  rig.idle.fire();
  await flush();
  assert.equal(
    rig.harness.loadCount('other'),
    0,
    'no second speculative import while the slot is held',
  );

  rig.harness.resolve('slow', rig.harness.moduleFor('slow'));
  await flush();
  assert.equal(rig.harness.preloadCount('slow'), 0, 'the abandoned slot never prepared its module');
  assert.equal(rig.harness.loadCount('other'), 1, 'the slot frees when the stale import settles');
  rig.harness.resolve('other', rig.harness.moduleFor('other'));
  await flush();
  assert.equal(rig.harness.preloadCount('other'), 1);
});

test('a stale ready or a late import cannot drive the next page', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  const stale = rig.session;
  stale.ready(rig.page.signal, 'ghost');
  assert.equal(rig.idle.pending(), 1);

  const next = attachPage(rig);
  assert.equal(rig.idle.cancellations(), 1, "the swap cancels the old page's idle neighbour");
  await selectCurrent(next, 'b');

  const queued = rig.idle.pending();
  stale.ready(rig.page.signal, 'ghost');
  assert.equal(rig.idle.pending(), queued, 'a stale ready queues nothing');
  assert.equal(rig.harness.loadCount('ghost'), 0);

  await assert.rejects(
    stale.loadCurrent('ghost', rig.page.signal, false),
    (error: unknown) => (error as Error)?.name === 'AbortError',
  );
  assert.equal(rig.harness.loadCount('ghost'), 0, 'a stale session cannot even start an import');

  const pending = attachPage(rig);
  const late = pending.session.loadCurrent('late', pending.page.signal, false);
  await flush();
  assert.equal(rig.harness.loadCount('late'), 1);
  const live = attachPage(rig); // another swap lands while the import is still in flight
  const idleBefore = rig.idle.pending();
  rig.harness.resolve('late', rig.harness.moduleFor('late'));
  await assert.rejects(late, (error: unknown) => (error as Error)?.name === 'AbortError');

  assert.deepEqual(rig.harness.mounts, [], 'a late import never mounts');
  assert.equal(rig.harness.preloadCount('late'), 0, 'a late import never prepares');
  assert.equal(rig.idle.pending(), idleBefore, 'a late import queues nothing on the new page');
  await selectCurrent(live, 'c');
  assert.equal(rig.harness.loadCount('c'), 1, 'the live page still works after the late arrival');
});

test('every weak-network or hidden policy forbids speculation but never the selection', async () => {
  const weak: HeroPreloadPolicy[] = [
    { reduced: false, hidden: true },
    { reduced: false, hidden: false, online: false },
    { reduced: false, hidden: false, saveData: true },
    ...['slow-2g', '2g', '3g'].map((effectiveType) => ({
      reduced: false,
      hidden: false,
      effectiveType,
    })),
  ];
  for (const policy of weak) {
    const label = JSON.stringify(policy);
    assert.equal(canPreloadHero(policy), false, label);
    const rig = createRig(policy);

    await selectCurrent(rig, 'cpu');
    assert.equal(rig.harness.preloadCount('cpu'), 1, `${label}: the selection still prepares`);
    assert.equal(rig.harness.preloads[0].signal, rig.page.signal, `${label}: on the active signal`);

    rig.session.ready(rig.page.signal, 'neighbour');
    rig.session.intent('target');
    await flush();
    assert.equal(rig.idle.pending(), 0, `${label}: no idle speculation is scheduled`);
    assert.equal(rig.harness.loadCount('neighbour'), 0, label);
    assert.equal(rig.harness.loadCount('target'), 0, `${label}: even an intent stays cold`);
    assert.deepEqual(rig.harness.mounts, [], label);
  }
});

test('a reduced selection returns its module and never calls preload', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'cpu');
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('cpu'), 1, 'the speculative import is already in flight');

  rig.policy.reduced = true; // the reader turns on reduced motion mid-flight
  const adapter = rig.harness.moduleFor('cpu');
  const active = new AbortController();
  const current = rig.session.loadCurrent('cpu', active.signal, true);
  await flush();
  rig.harness.resolve('cpu', adapter);
  assert.equal(await current, adapter, 'the reduced selection still returns a module');
  await flush();

  assert.equal(rig.harness.preloadCount('cpu'), 0, 'no preparation runs for a reduced selection');
  assert.equal(rig.harness.loadCount('cpu'), 1, 'one import serves both');
  assert.deepEqual(rig.harness.mounts, []);
});

test('refresh closes the gate: the pending idle and the running preparation both stop', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('b', rig.harness.moduleFor('b', { preload: neverSettles }));
  await flush();
  const signal = rig.harness.preloadSignal('b');
  rig.session.ready(rig.page.signal, 'c');
  assert.equal(rig.idle.pending(), 1, 'a second neighbour is waiting');

  rig.policy.hidden = true;
  assert.equal(canPreloadHero(rig.policy), false);
  rig.session.refresh();
  assert.equal(signal.aborted, true, 'refresh releases the running preparation');
  assert.equal(rig.idle.lastCancelled(), true, 'refresh cancels the pending idle callback');
  assert.equal(rig.idle.pending(), 0);
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('c'), 0);
});

test('refresh re-checks the gate and resumes speculation when the page is allowed again', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.intent('queued');
  assert.equal(rig.harness.loadCount('queued'), 0, 'the intent waits for ready()');

  rig.policy.hidden = true;
  rig.session.refresh();
  rig.session.ready(rig.page.signal, 'neighbour');
  rig.session.intent('another');
  assert.equal(rig.idle.pending(), 0, 'ready() schedules nothing while hidden');
  assert.equal(rig.harness.loadCount('another'), 0);
  assert.equal(rig.harness.loadCount('queued'), 0);

  rig.policy.hidden = false;
  rig.session.refresh();
  assert.equal(rig.idle.pending(), 1, 'refresh resumes the next-entry idle');
  rig.idle.fire();
  await flush();
  assert.equal(rig.harness.loadCount('neighbour'), 1);
  assert.equal(
    rig.harness.loadCount('queued'),
    0,
    'the request dropped while hidden stays dropped',
  );
  assert.equal(rig.harness.loadCount('another'), 0);
  assert.deepEqual(rig.harness.mounts, []);
});

test('a real consumer joins the running preload before the speculative signal is released', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');

  const order: string[] = [];
  let specSignal: AbortSignal | undefined;
  let specAbortedWhenRealJoined: boolean | undefined;
  let resourceLoads = 0;
  let releaseResource: () => void = () => {};
  let shared: Promise<string> | undefined;
  const used: Promise<string>[] = [];
  const active = new AbortController();

  const hero = rig.harness.moduleFor('hero', {
    preload: (signal) => {
      if (signal === active.signal) {
        order.push('real');
        specAbortedWhenRealJoined = specSignal?.aborted;
      } else {
        specSignal = signal;
        order.push('spec');
      }
      if (!shared) {
        resourceLoads += 1;
        shared = new Promise<string>((resolve) => {
          releaseResource = () => resolve('bytes');
        });
      }
      used.push(shared);
      return shared.then(() => undefined);
    },
  });

  rig.session.ready(rig.page.signal, 'hero');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('hero', hero);
  await flush();
  assert.deepEqual(order, ['spec'], 'the speculative preparation started first');
  assert.equal(rig.harness.preloadCount('hero'), 1);

  await withoutUnhandledRejections(async () => {
    const current = rig.session.loadCurrent('hero', active.signal, false);
    await flush();
    assert.deepEqual(
      order,
      ['spec', 'real'],
      'the real consumer prepares while the speculation runs',
    );
    assert.equal(
      specAbortedWhenRealJoined,
      false,
      'the speculative signal is live as the consumer joins',
    );

    assert.equal(await current, hero, 'the selection returns without waiting for the preparation');
    assert.equal(specSignal?.aborted, true, 'the speculative signal is released after the join');

    assert.equal(rig.harness.loadCount('hero'), 1, 'one import for the module');
    assert.equal(resourceLoads, 1, 'both preparations share one resource');
    assert.equal(used.length, 2);
    assert.equal(used[0], used[1], 'the same resource promise serves both');

    releaseResource();
    await flush();
  });

  rig.session.ready(active.signal, 'next');
  rig.idle.fire();
  await flush();
  assert.equal(
    rig.harness.loadCount('next'),
    1,
    'the slot frees once the shared preparation settles',
  );
  assert.deepEqual(rig.harness.mounts, []);
});

test('the coordinator never mounts a module or needs a canvas', async () => {
  const rig = createRig();
  await selectCurrent(rig, 'a');
  rig.session.ready(rig.page.signal, 'b');
  rig.idle.fire();
  await flush();
  rig.harness.resolve('b', rig.harness.moduleFor('b'));
  await flush();
  rig.session.intent('c');
  await flush();
  rig.harness.resolve('c', rig.harness.moduleFor('c'));
  await flush();
  rig.session.refresh();
  rig.session.dispose();

  assert.deepEqual(rig.harness.mounts, [], 'no module default ran');
  assert.deepEqual(rig.harness.sceneCalls, [], 'no scene was created');
  assert.deepEqual(rig.harness.contextCalls, [], 'no drawing context was requested');
  // This suite drives the whole contract from AbortControllers and plain objects only.
  assert.equal((globalThis as Record<string, unknown>).document, undefined);
  assert.equal((globalThis as Record<string, unknown>).requestAnimationFrame, undefined);
});

test('a late module from a superseded selection rejects and never becomes current', async () => {
  const rig = createRig();
  const firstActive = new AbortController();
  const secondActive = new AbortController();
  const moduleA = rig.harness.moduleFor('a');
  const moduleB = rig.harness.moduleFor('b');

  const first = rig.session.loadCurrent('a', firstActive.signal, false);
  await flush();
  const second = rig.session.loadCurrent('b', secondActive.signal, false);
  await flush();

  rig.harness.resolve('a', moduleA);
  assert.equal(
    firstActive.signal.aborted,
    false,
    'the superseded signal was never aborted by hand',
  );
  await assert.rejects(first, (error: unknown) => (error as Error)?.name === 'AbortError');
  assert.deepEqual(rig.harness.mounts, [], 'the superseded module never mounts');
  assert.equal(rig.harness.preloadCount('a'), 0, 'the superseded module never prepares');

  rig.harness.resolve('b', moduleB);
  assert.equal(await second, moduleB, 'the last selection is the current one');
  assert.equal(rig.harness.preloadCount('b'), 1);

  rig.session.ready(secondActive.signal, 'next');
  assert.equal(rig.idle.pending(), 1, "the current selection's ready is honoured");
  rig.session.ready(firstActive.signal, 'stale');
  assert.equal(rig.idle.pending(), 1, 'a superseded signal cannot add a next entry');

  secondActive.abort();
  rig.session.ready(secondActive.signal, 'dead-next');
  assert.equal(rig.idle.pending(), 1, 'ready() after the active signal ended does nothing');

  rig.idle.fire();
  await flush();
  rig.harness.resolve('next', rig.harness.moduleFor('next'));
  await flush();
  assert.equal(rig.harness.loadCount('next'), 1);
  assert.equal(rig.harness.loadCount('stale'), 0);
  assert.equal(rig.harness.loadCount('dead-next'), 0);
  assert.deepEqual(rig.harness.mounts, []);
});
