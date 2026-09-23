/* Targeted tests for the reader fetch scheduler (server/reader/service.mjs).
 *
 * The store is the real in-memory one, the clock is a counter and the interval timer is a fake
 * that records its callback, so every schedule in here is decided by the test rather than by
 * wall-clock time.  `fetchFeed` is injected and hands back a deferred per call: no network is
 * touched, and each test states exactly when a download succeeds, fails or resolves late.
 * Deferred calls are settled in `finally`, so a failing assertion cannot hang the runner.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LIMITS, RETRY_MS, ReaderError } from '../server/reader/model.mjs';
import { createReaderService as createServiceModule } from '../server/reader/service.mjs';
import { openReaderStore as openStoreModule } from '../server/reader/store.mjs';

type Source = {
  id: string;
  feedUrl: string;
  title: string;
  enabled: boolean;
  status: string;
  siteUrl: string | null;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  nextFetchAt: number;
  errorCode: string | null;
  failureCount: number;
  entryCount: number;
  etag: string | null;
  lastModified: string | null;
  leaseToken: string | null;
  leaseUntil: number | null;
};

type Entry = { id: string; sourceId: string; title: string; sourceTitle: string };

type Store = {
  addSource(input: { feedUrl: string; title?: string | null }, now: number): Source;
  getSource(id: string): Source | null;
  listSources(admin?: boolean): Source[];
  updateSource(
    id: string,
    patch: { title?: string | null; enabled?: boolean },
    now: number,
  ): Source;
  deleteSource(id: string): boolean;
  dueSources(now: number): Source[];
  claimSource(id: string, now: number, force?: boolean): Source | null;
  completeSource(
    id: string,
    token: string | null,
    result: {
      feed?: unknown;
      notModified?: boolean;
      etag?: string | null;
      lastModified?: string | null;
    },
    now: number,
  ): boolean;
  failSource(
    id: string,
    token: string | null,
    failure: { code?: string; retryAfterMs?: number },
    now: number,
  ): boolean;
  releaseSource(id: string, token: string | null): boolean;
  clearEntries(id: string, now: number): boolean;
  listEntries(options?: { sourceId?: string }): { entries: Entry[]; nextCursor: string | null };
  getAdmin(): { passwordHash: string; version: number } | null;
  setAdminPassword(passwordHash: string): number;
  createSession(input: { tokenHash: string; expiresAt: number }, now: number): unknown;
  cleanupSessions(now: number): number;
  close(): void;
};

type Service = {
  start(): void;
  scan(): void;
  idle(): Promise<void>;
  stop(): Promise<void>;
  addSource(input: { feedUrl: string; title?: string | null }): string;
  updateSource(id: string, patch: { title?: string | null; enabled?: boolean }): string;
  deleteSource(id: string): void;
  clearEntries(id: string): void;
  refresh(id: string): void;
};

type Report = { sourceId: string | null; code: string };

/** One synthetic download: the test decides when and how it settles. */
type Call = {
  url: string;
  etag: string | null;
  lastModified: string | null;
  signal: AbortSignal | undefined;
  aborted: boolean;
  settled: boolean;
  resolve(payload: unknown): void;
  reject(error: unknown): void;
};

type Interval = {
  callback: () => void;
  delay: number;
  cleared: boolean;
  unrefCalled: boolean;
  unref(): void;
};

const openReaderStore = openStoreModule as unknown as (filename: string) => Store;
const createReaderService = createServiceModule as unknown as (options: {
  store: Store;
  fetchFeed: (
    url: string,
    options: { signal?: AbortSignal; etag?: string | null; lastModified?: string | null },
  ) => Promise<unknown>;
  now: () => number;
  timers: {
    setInterval: (callback: () => void, delay: number) => Interval;
    clearInterval: (handle: Interval) => void;
  };
  onError?: (report: Report) => void;
}) => Service;

const FEED_URL = 'https://feeds.example.net/subscribe.xml';
const START = 1_700_000_000_000;

/** A minimal RSS 2.0 document; the shape the parser contract and the store both accept. */
function feedXml(
  title: string,
  items: { id: string; title: string; updated: string }[],
  site = 'https://feeds.example.net/',
): string {
  const entries = items
    .map(
      (item) =>
        `    <item><guid isPermaLink="false">${item.id}</guid><title>${item.title}</title>` +
        `<link>${site}${item.id}</link><pubDate>${item.updated}</pubDate>` +
        `<description>&lt;p&gt;body ${item.id}&lt;/p&gt;</description></item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>${title}</title>
    <link>${site}</link>
${entries}
  </channel>
</rss>`;
}

const TWO_ITEMS = [
  { id: 'tag:feeds.example.net,2026:1', title: 'First', updated: '2026-09-01T10:00:00Z' },
  { id: 'tag:feeds.example.net,2026:2', title: 'Second', updated: '2026-09-02T10:00:00Z' },
];

/** The download result the real fetcher returns for a fresh feed. */
function downloaded(xml: string, extra: Record<string, unknown> = {}) {
  return { url: FEED_URL, etag: 'E1', lastModified: 'L1', notModified: false, xml, ...extra };
}

async function tick(rounds = 3) {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function failure(work: () => unknown): { code?: string; status?: number } {
  try {
    work();
  } catch (error) {
    return error as { code?: string; status?: number };
  }
  throw new Error('the call was expected to throw');
}

/** Every fixture of one test: the store, the service, its fake timer and its deferred calls. */
function setup(existingStore?: Store) {
  const clock = { t: START };
  const store = existingStore ?? openReaderStore(':memory:');
  const calls: Call[] = [];
  const reports: Report[] = [];
  const intervals: Interval[] = [];
  const cleanupResults: number[] = [];
  const watched: Store = {
    ...store,
    cleanupSessions: (at: number) => {
      const removed = store.cleanupSessions(at);
      cleanupResults.push(removed);
      return removed;
    },
  };
  const timers = {
    setInterval(callback: () => void, delay: number) {
      const interval: Interval = {
        callback,
        delay,
        cleared: false,
        unrefCalled: false,
        unref() {
          interval.unrefCalled = true;
        },
      };
      intervals.push(interval);
      return interval;
    },
    clearInterval(handle: Interval) {
      handle.cleared = true;
    },
  };
  const fetchFeed = (
    url: string,
    options: { signal?: AbortSignal; etag?: string | null; lastModified?: string | null } = {},
  ) =>
    new Promise((resolve, reject) => {
      const call: Call = {
        url,
        etag: options.etag ?? null,
        lastModified: options.lastModified ?? null,
        signal: options.signal,
        aborted: false,
        settled: false,
        resolve(payload) {
          call.settled = true;
          resolve(payload);
        },
        reject(error) {
          call.settled = true;
          reject(error);
        },
      };
      options.signal?.addEventListener('abort', () => {
        call.aborted = true;
      });
      calls.push(call);
    });
  const service = createReaderService({
    store: watched,
    fetchFeed,
    now: () => clock.t,
    timers,
    onError: (report) => {
      reports.push(report);
    },
  });
  /** Seeds a source directly, as another process or an earlier run would have left it. */
  const seed = (feedUrl = FEED_URL, at = clock.t) => store.addSource({ feedUrl }, at);
  const close = () => {
    for (const call of calls) if (!call.settled) call.reject(new Error('fixture closed'));
  };
  /** Builds another service over the same store, as a restarted process would. */
  const build = (overrides: { store?: Store } = {}) =>
    createReaderService({
      store: overrides.store ?? watched,
      fetchFeed,
      now: () => clock.t,
      timers,
      onError: (report) => {
        reports.push(report);
      },
    });
  return {
    clock,
    store,
    calls,
    reports,
    intervals,
    cleanupResults,
    service,
    timers,
    fetchFeed,
    build,
    seed,
    close,
  };
}

test('start fetches a due source, schedules the next attempt a day out and scans every thirty seconds', async () => {
  const fixture = setup();
  const { clock, store, service, calls, intervals } = fixture;
  try {
    const source = fixture.seed(FEED_URL, clock.t - 5_000);
    service.start();
    assert.equal(intervals.length, 1);
    assert.equal(intervals[0].delay, 30_000);
    assert.equal(intervals[0].unrefCalled, true); // the timer never holds the process open

    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, FEED_URL);
    assert.equal(calls[0].etag, null); // nothing cached for the first attempt
    assert.equal(calls[0].lastModified, null);
    calls[0].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();

    const stored = store.getSource(source.id);
    assert.ok(stored);
    assert.equal(stored.status, 'ok');
    assert.equal(stored.lastSuccessAt, clock.t);
    assert.equal(stored.nextFetchAt, clock.t + LIMITS.intervalMs); // one day, not thirty seconds
    assert.equal(stored.entryCount, 2);
    assert.equal(stored.leaseToken, null);
    assert.equal(store.listEntries({}).entries.length, 2);

    // A tick one millisecond before the due time must not fetch again.
    clock.t += LIMITS.intervalMs - 1;
    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 1);

    clock.t += 1;
    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].etag, 'E1'); // the validator of the first success is offered back
    assert.equal(calls[1].lastModified, 'L1');
    calls[1].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(source.id)?.nextFetchAt, clock.t + LIMITS.intervalMs);
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('the thirty-second scan clears expired sessions and keeps running with no page access', async () => {
  const fixture = setup();
  const { clock, store, service, calls, intervals, cleanupResults } = fixture;
  try {
    store.setAdminPassword('synthetic-hash'); // the store never hashes; auth supplies the hash
    // One session that has already run out, written as a stopped process would have left it.
    store.createSession(
      { tokenHash: 'expired', expiresAt: clock.t - 1 },
      clock.t - LIMITS.sessionMs,
    );
    const source = fixture.seed();
    assert.deepEqual(
      store.dueSources(clock.t).map((item) => item.id),
      [source.id],
    );

    // Nothing in this test opens a page, calls scan() or touches the service again: the captured
    // interval alone has to keep the reader moving.
    service.start();
    assert.equal(cleanupResults.length, 1); // the start-up scan already swept the sessions
    assert.equal(cleanupResults[0], 1);

    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 1);
    calls[0].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.listEntries({}).entries.length, 2);

    // A day passes with nobody looking at the reader. The next tick picks up the source that
    // appeared meanwhile, and the first one comes round again on its own schedule.
    const late = fixture.seed('https://feeds.example.net/late.xml', clock.t);
    clock.t += LIMITS.intervalMs;
    intervals[0].callback();
    await tick();
    assert.deepEqual(
      calls.map((call) => call.url),
      [FEED_URL, 'https://feeds.example.net/late.xml'],
    );
    calls[1].resolve(downloaded(feedXml('Late notes', TWO_ITEMS)));
    await tick();
    assert.equal(calls.length, 3); // the first source is due again after its day
    assert.equal(calls[2].url, FEED_URL);
    calls[2].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(late.id)?.entryCount, 2);
    assert.equal(store.getSource(source.id)?.lastSuccessAt, clock.t);
    assert.equal(cleanupResults.length >= 3, true); // every tick sweeps sessions too
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('a 304 and a failure both keep the entries and the validators while the schedule moves on', async () => {
  const fixture = setup();
  const { clock, store, service, calls, intervals, reports } = fixture;
  try {
    const source = fixture.seed();
    service.start();
    await tick();
    calls[0].resolve(
      downloaded(feedXml('Field notes', TWO_ITEMS), {
        etag: 'W/"v1"',
        lastModified: 'Mon, 01 Sep 2026 10:00:00 GMT',
      }),
    );
    await service.idle();
    const firstSuccess = clock.t;
    assert.equal(store.getSource(source.id)?.entryCount, 2);

    // The feed answers 304: nothing is re-parsed, nothing is deleted, the validators stay.
    clock.t += LIMITS.intervalMs;
    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].etag, 'W/"v1"');
    assert.equal(calls[1].lastModified, 'Mon, 01 Sep 2026 10:00:00 GMT');
    calls[1].resolve({
      url: FEED_URL,
      etag: 'W/"v1"',
      lastModified: 'Mon, 01 Sep 2026 10:00:00 GMT',
      notModified: true,
    });
    await service.idle();
    const unchanged = store.getSource(source.id);
    assert.ok(unchanged);
    assert.equal(unchanged.status, 'ok');
    assert.equal(unchanged.lastSuccessAt, clock.t);
    assert.equal(unchanged.nextFetchAt, clock.t + LIMITS.intervalMs);
    assert.equal(unchanged.etag, 'W/"v1"');
    assert.equal(unchanged.lastModified, 'Mon, 01 Sep 2026 10:00:00 GMT');
    assert.equal(unchanged.entryCount, 2);
    assert.equal(unchanged.failureCount, 0);
    assert.deepEqual(reports, []); // a 304 is a success, never reported as an error

    // A rate-limited upstream: the retry delay follows the header, the shorter backoff wins.
    clock.t += LIMITS.intervalMs;
    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 3);
    const throttled = Object.assign(new ReaderError('UPSTREAM_HTTP', 502), { retryAfterMs: 5_000 });
    calls[2].reject(throttled);
    await service.idle();
    const failed = store.getSource(source.id);
    assert.ok(failed);
    assert.equal(failed.status, 'error');
    assert.equal(failed.errorCode, 'UPSTREAM_HTTP'); // the bounded code of the fetcher
    assert.equal(failed.failureCount, 1);
    assert.equal(failed.nextFetchAt, clock.t + Math.max(RETRY_MS[0], 5_000));
    assert.equal(failed.lastSuccessAt, firstSuccess + LIMITS.intervalMs);
    assert.equal(failed.entryCount, 2);
    assert.equal(failed.etag, 'W/"v1"');
    assert.equal(failed.leaseToken, null);

    // An unexpected error cannot leak its message, and a mislabelled code is replaced.
    clock.t = failed.nextFetchAt;
    intervals[0].callback();
    await tick();
    calls[3].reject(new Error('upstream said: http://internal.example/secret'));
    await service.idle();
    assert.equal(store.getSource(source.id)?.errorCode, 'FETCH_FAILED');

    clock.t = store.getSource(source.id)!.nextFetchAt;
    intervals[0].callback();
    await tick();
    calls[4].reject(new ReaderError('Timeout!', 504));
    await service.idle();
    assert.equal(store.getSource(source.id)?.errorCode, 'FETCH_FAILED');

    assert.deepEqual(reports, [
      { sourceId: source.id, code: 'UPSTREAM_HTTP' },
      { sourceId: source.id, code: 'FETCH_FAILED' },
      { sourceId: source.id, code: 'FETCH_FAILED' },
    ]);
    for (const report of reports)
      assert.deepEqual(Object.keys(report).sort(), ['code', 'sourceId']);
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('a source is never downloaded twice at once and the drain stays sequential', async () => {
  const fixture = setup();
  const { clock, store, service, calls, intervals } = fixture;
  try {
    const source = fixture.seed();
    service.start();
    await tick();
    assert.equal(calls.length, 1);

    // A refresh while the download is running is dropped, not queued behind it, and a scan sees
    // nothing new because the in-flight attempt holds that source's lease.
    service.refresh(source.id);
    service.refresh(source.id);
    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 1);

    calls[0].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(calls.length, 1); // the dropped refreshes stayed dropped
    assert.equal(store.getSource(source.id)?.entryCount, 2);

    // Two due sources drain one after the other, never in parallel. The first source is already
    // scheduled for tomorrow, so this scan has exactly the two new ones to do.
    const second = fixture.seed('https://feeds.example.net/second.xml', clock.t);
    const third = fixture.seed('https://feeds.example.net/third.xml', clock.t);
    intervals[0].callback();
    await tick();
    assert.equal(calls.filter((call) => !call.settled).length, 1);
    calls[1].resolve(downloaded(feedXml('Second', TWO_ITEMS)));
    await tick();
    assert.equal(calls.filter((call) => !call.settled).length, 1);
    calls[2].resolve(downloaded(feedXml('Third', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(second.id)?.status, 'ok');
    assert.equal(store.getSource(third.id)?.status, 'ok');
    assert.equal(store.listEntries({}).entries.length, 6);
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('refresh skips the schedule but never takes a live lease', async () => {
  const fixture = setup();
  const { clock, store, service, calls } = fixture;
  try {
    const source = fixture.seed();
    // Another worker holds the lease: the store refuses a claim until it expires, forced or not.
    const held = store.claimSource(source.id, clock.t);
    assert.ok(held);
    service.refresh(source.id);
    await tick();
    assert.equal(calls.length, 0);
    const stillHeld = store.getSource(source.id);
    assert.equal(stillHeld?.leaseToken, held.leaseToken);
    assert.equal(stillHeld?.status, 'fetching');

    // Once that lease runs out, the same refresh goes through.
    clock.t = held.leaseUntil as number;
    service.refresh(source.id);
    await tick();
    assert.equal(calls.length, 1);
    calls[0].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(source.id)?.lastSuccessAt, clock.t);

    // Long before the next due time, an explicit refresh still fetches (force skips the schedule).
    service.refresh(source.id);
    await tick();
    assert.equal(calls.length, 2);
    assert.equal(store.getSource(source.id)?.nextFetchAt, clock.t + LIMITS.intervalMs); // the schedule is untouched
    calls[1].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(source.id)?.status, 'ok');
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('a restart picks up an expired lease and leaves a live one alone', async () => {
  const fixture = setup();
  const { clock, store, calls } = fixture;
  try {
    // A crashed worker claimed this source a lease ago and left the lease behind.
    const claimedAt = clock.t - LIMITS.leaseMs - 1;
    const stale = fixture.seed('https://feeds.example.net/stale.xml', claimedAt);
    const abandoned = store.claimSource(stale.id, claimedAt);
    assert.ok(abandoned);
    assert.ok((abandoned.leaseUntil as number) < clock.t);
    // A second worker is still running and holds a live lease.
    const live = fixture.seed('https://feeds.example.net/live.xml');
    const busy = store.claimSource(live.id, clock.t);
    assert.ok(busy);

    const restarted = fixture.build();
    restarted.start();
    await tick();
    assert.deepEqual(
      calls.map((call) => call.url),
      ['https://feeds.example.net/stale.xml'],
    ); // the live lease is respected, the dead one is taken over
    calls[0].resolve(downloaded(feedXml('Stale', TWO_ITEMS)));
    await restarted.idle();
    const taken = store.getSource(stale.id);
    assert.equal(taken?.status, 'ok');
    assert.equal(taken?.leaseToken, null);
    assert.equal(taken?.entryCount, 2);
    assert.equal(store.getSource(live.id)?.leaseToken, busy.leaseToken); // untouched

    // When the live lease expires, the running scheduler waits no longer than the tick.
    clock.t = busy.leaseUntil as number;
    fixture.intervals[0].callback();
    await tick();
    assert.equal(calls.length, 2);
    calls[1].resolve(downloaded(feedXml('Live', TWO_ITEMS)));
    await restarted.idle();
    assert.equal(store.getSource(live.id)?.status, 'ok');
    await restarted.stop();
  } finally {
    fixture.close();
    await fixture.service.stop();
    store.close();
  }
});

test('a late result never lands on a disabled or deleted source', async () => {
  const fixture = setup();
  const { store, service, calls, reports } = fixture;
  try {
    // The source is disabled while its download is on the wire.
    const disabled = fixture.seed('https://feeds.example.net/disabled.xml');
    service.start();
    await tick();
    assert.equal(calls.length, 1); // the drain runs one download at a time
    service.updateSource(disabled.id, { enabled: false });
    assert.equal(calls[0].aborted, true); // the scheduler cancelled what it could

    // The response arrives anyway, as a fetch that already had its body would.
    calls[0].resolve(downloaded(feedXml('Disabled', TWO_ITEMS)));
    await service.idle();
    const paused = store.getSource(disabled.id);
    assert.equal(paused?.enabled, false);
    assert.equal(paused?.status, 'paused');
    assert.equal(paused?.entryCount, 0);
    assert.equal(paused?.failureCount, 0); // an abandoned attempt is not a failure
    assert.equal(paused?.leaseToken, null);
    assert.deepEqual(store.listEntries({}).entries, []);
    assert.deepEqual(reports, []); // a cancelled attempt is not reported either

    // The source is deleted while its download is on the wire.
    const doomed = fixture.seed('https://feeds.example.net/deleted.xml');
    service.refresh(doomed.id);
    await tick();
    assert.equal(calls.length, 2);
    service.deleteSource(doomed.id);
    assert.equal(calls[1].aborted, true);
    calls[1].resolve(downloaded(feedXml('Deleted', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(doomed.id), null);
    assert.deepEqual(store.listEntries({}).entries, []);
    assert.deepEqual(reports, []);

    // A source deleted while it waits its turn is never downloaded at all.
    const queuedUrl = 'https://feeds.example.net/queued.xml';
    const aheadUrl = 'https://feeds.example.net/ahead.xml';
    const queued = fixture.seed(queuedUrl);
    const ahead = fixture.seed(aheadUrl);
    service.scan();
    await tick();
    assert.equal(calls.length, 3);
    const waitingUrl = calls[2].url === queuedUrl ? aheadUrl : queuedUrl;
    const fetchedUrl = calls[2].url;
    service.deleteSource(waitingUrl === queuedUrl ? queued.id : ahead.id);
    calls[2].resolve(downloaded(feedXml('Ahead', TWO_ITEMS)));
    await service.idle();
    assert.equal(calls.length, 3); // the deleted one never started
    const registered = store.listSources(true).map((item) => item.feedUrl);
    assert.equal(registered.includes(fetchedUrl), true);
    assert.equal(registered.includes(waitingUrl), false); // the queued source was withdrawn
    const fetchedId = fetchedUrl === aheadUrl ? ahead.id : queued.id;
    const waitingId = fetchedUrl === aheadUrl ? queued.id : ahead.id;
    assert.equal(store.listEntries({ sourceId: fetchedId }).entries.length, 2);
    assert.deepEqual(store.listEntries({ sourceId: waitingId }).entries, []);
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('a cleared or quickly re-enabled source only accepts the newest result', async () => {
  const fixture = setup();
  const { store, service, calls } = fixture;
  try {
    const cleared = fixture.seed('https://feeds.example.net/cleared.xml');
    service.start();
    await tick();
    calls[0].resolve(downloaded(feedXml('First', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(cleared.id)?.entryCount, 2);

    // Clear the cache while a refresh is on the wire; the old download must not restore it.
    service.refresh(cleared.id);
    await tick();
    assert.equal(calls.length, 2);
    service.clearEntries(cleared.id);
    assert.equal(store.getSource(cleared.id)?.entryCount, 0);
    calls[1].resolve(
      downloaded(
        feedXml('Stale', [{ id: 'stale-1', title: 'Stale', updated: '2026-09-03T10:00:00Z' }]),
      ),
    );
    await tick();
    assert.equal(calls.length, 3); // clearing queued a fresh attempt
    calls[2].resolve(
      downloaded(
        feedXml('Fresh', [{ id: 'fresh-1', title: 'Fresh', updated: '2026-09-04T10:00:00Z' }]),
      ),
    );
    await service.idle();
    const afterClear = store.listEntries({ sourceId: cleared.id }).entries;
    assert.deepEqual(
      afterClear.map((item) => item.title),
      ['Fresh'],
    );

    // Disable and enable again while the next download is running: only the new one may write.
    service.refresh(cleared.id);
    await tick();
    assert.equal(calls.length, 4);
    service.updateSource(cleared.id, { enabled: false });
    service.updateSource(cleared.id, { enabled: true });
    calls[3].resolve(
      downloaded(
        feedXml('Ghost', [{ id: 'ghost-1', title: 'Ghost', updated: '2026-09-05T10:00:00Z' }]),
      ),
    );
    await tick();
    assert.equal(calls.length, 5);
    calls[4].resolve(
      downloaded(
        feedXml('Live', [{ id: 'live-1', title: 'Live', updated: '2026-09-06T10:00:00Z' }]),
      ),
    );
    await service.idle();
    const afterToggle = store.listEntries({ sourceId: cleared.id }).entries;
    assert.deepEqual(
      afterToggle.map((item) => item.title).sort(),
      ['Fresh', 'Live'], // the late Ghost never landed; the archive keeps what it has
    );
    assert.equal(store.getSource(cleared.id)?.status, 'ok');
    assert.equal(store.getSource(cleared.id)?.leaseToken, null);
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('a stopped service refuses every change and leaves the store untouched', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'reader-service-stopped-'));
  const path = join(directory, 'reader.db');
  const fileStore = openReaderStore(path);
  const fixture = setup(fileStore);
  const { store, service, calls } = fixture;
  try {
    // One source that succeeds and one that stays paused, so each call has a real target.
    const live = fixture.seed();
    const pausedId = fixture.seed('https://feeds.example.net/paused.xml').id;
    store.updateSource(pausedId, { enabled: false }, fixture.clock.t);
    service.start();
    await tick();
    calls[0].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    await service.stop();

    // Only the database and its write-ahead log hold data; the -shm file is shared-memory
    // bookkeeping that a plain read may touch, so it stays out of the comparison.
    const bytesOf = () => ({
      database: readFileSync(path).toString('base64'),
      wal: existsSync(`${path}-wal`) ? readFileSync(`${path}-wal`).toString('base64') : null,
      files: readdirSync(directory).sort(),
    });
    const rowsOf = () =>
      JSON.stringify({ sources: store.listSources(true), entries: store.listEntries({}) });
    const beforeBytes = bytesOf();
    const beforeRows = rowsOf();
    const beforeTitle = store.getSource(live.id)!.title; // the feed title a success replaced

    const refused = [
      ['add', () => service.addSource({ feedUrl: 'https://feeds.example.net/after-stop.xml' })],
      ['update title', () => service.updateSource(live.id, { title: 'Renamed after stop' })],
      ['update enabled', () => service.updateSource(pausedId, { enabled: true })],
      ['delete', () => service.deleteSource(pausedId)],
      ['clear', () => service.clearEntries(live.id)],
      ['refresh', () => service.refresh(live.id)],
    ] as const;
    for (const [label, call] of refused) {
      const error = failure(call);
      assert.equal(error.code, 'READER_UNAVAILABLE', label);
      assert.equal(error.status, 503, label);
    }

    assert.deepEqual(bytesOf(), beforeBytes); // not one byte of the database moved
    assert.deepEqual(rowsOf(), beforeRows); // and no row changed either
    const survivor = store.getSource(live.id);
    assert.equal(survivor?.title, beforeTitle);
    assert.equal(survivor?.entryCount, 2);
    assert.equal(store.getSource(pausedId)?.enabled, false); // neither was deleted nor resumed
    assert.equal(store.listSources().length, 2);
    await tick();
    assert.equal(calls.length, 1); // and nothing was queued for a fetch
  } finally {
    fixture.close();
    await service.stop();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('stop clears the timer, releases the lease and refuses further work', async () => {
  const fixture = setup();
  const { store, service, calls, intervals } = fixture;
  try {
    const source = fixture.seed();
    service.start();
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].aborted, false);

    const stopping = service.stop();
    await tick();
    assert.equal(intervals[0].cleared, true); // the interval was handed back
    assert.equal(calls[0].aborted, true); // and the running attempt was cancelled
    calls[0].resolve(downloaded(feedXml('Late', TWO_ITEMS))); // even a fetch that ignores abort
    await stopping;
    await service.idle();

    const afterStop = store.getSource(source.id);
    assert.equal(afterStop?.entryCount, 0); // the late result was not written
    assert.equal(afterStop?.status, 'pending'); // released, not failed
    assert.equal(afterStop?.failureCount, 0);
    assert.equal(afterStop?.leaseToken, null);
    assert.equal(afterStop?.errorCode, null);

    // The stopped scheduler is inert: no timer, no new work, and it says so.
    intervals[0].callback();
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(intervals.length, 1);
    service.start();
    assert.equal(intervals.length, 1);
    assert.equal(failure(() => service.refresh(source.id)).code, 'READER_UNAVAILABLE');
    // A stopped service accepts no new work, whatever the URL.  Whether it also writes the row
    // before refusing is the implementation's business and is not pinned here.
    const late = failure(() =>
      service.addSource({ feedUrl: 'https://feeds.example.net/after-stop.xml' }),
    );
    assert.equal(late.code, 'READER_UNAVAILABLE');
    assert.equal(late.status, 503);
    assert.equal(store.getSource(source.id)?.leaseToken, null);
    await service.stop(); // stopping twice is harmless
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});

test('the service validates what it accepts and reports bounded errors for missing sources', async () => {
  const fixture = setup();
  const { store, service, calls, clock } = fixture;
  try {
    const bad = failure(() =>
      service.addSource({ feedUrl: 'ftp://feeds.example.net/subscribe.xml' }),
    );
    assert.equal(bad.code, 'INVALID_URL');
    assert.equal(
      failure(() => service.addSource({ feedUrl: 'https://user:pass@feeds.example.net/f.xml' }))
        .code,
      'INVALID_URL',
    );
    assert.equal(failure(() => service.refresh('no-such-source')).code, 'NOT_FOUND');
    assert.equal(failure(() => service.deleteSource('no-such-source')).code, 'NOT_FOUND');

    const id = service.addSource({ feedUrl: FEED_URL, title: 'My feed' });
    assert.equal(typeof id, 'string');
    assert.equal(store.getSource(id)?.title, 'My feed');
    await tick();
    assert.equal(calls.length, 1); // a new source is fetched straight away
    calls[0].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(id)?.entryCount, 2);

    assert.equal(service.updateSource(id, { title: 'Renamed' }), id);
    assert.equal(store.getSource(id)?.title, 'Renamed');
    assert.equal(service.updateSource(id, { enabled: false }), id);
    assert.equal(store.getSource(id)?.status, 'paused');
    const paused = failure(() => service.refresh(id));
    assert.equal(paused.code, 'SOURCE_PAUSED');
    assert.equal(paused.status, 409);
    service.updateSource(id, { enabled: true });
    await tick();
    assert.equal(calls.length, 2); // re-enabling fetches without waiting for the schedule
    calls[1].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();

    service.clearEntries(id);
    assert.equal(store.getSource(id)?.entryCount, 0);
    assert.equal(store.getSource(id)?.etag, null);
    clock.t += 1;
    await tick();
    assert.equal(calls.length, 3); // and clearing re-fetches
    calls[2].resolve(downloaded(feedXml('Field notes', TWO_ITEMS)));
    await service.idle();
    assert.equal(store.getSource(id)?.entryCount, 2);

    service.deleteSource(id);
    assert.equal(store.getSource(id), null);
    assert.deepEqual(store.listEntries({}).entries, []);
  } finally {
    fixture.close();
    await service.stop();
    store.close();
  }
});
