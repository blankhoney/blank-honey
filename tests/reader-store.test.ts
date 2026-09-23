/* Targeted tests for the feed reader store (server/reader/store.mjs).
 *
 * Every fixture is either an in-memory database or a throwaway directory under the system
 * temporary directory, closed and removed in a `finally`, so nothing here touches project data.
 * The tests pin the durability and ownership rules of the store: what it may create, what it must
 * refuse to overwrite, and what one fetch cycle is allowed to change.
 */
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { LIMITS, RETRY_MS } from '../server/reader/model.mjs';
import { openReaderStore as openStoreModule } from '../server/reader/store.mjs';
import type {
  ReaderAdminSource,
  ReaderDetail,
  ReaderEntries,
  ReaderSource,
} from '../src/domain/reader';

/** The source shape the store keeps internally: the DTO plus the fields only the server sees. */
type InternalSource = ReaderAdminSource & {
  etag: string | null;
  lastModified: string | null;
  leaseToken: string | null;
  leaseUntil: number | null;
};

type Feed = { title?: string | null; siteUrl?: string | null; entries: unknown[] };
type Completion = {
  feed?: Feed;
  notModified?: boolean;
  etag?: string | null;
  lastModified?: string | null;
};
type Session = { tokenHash: string; adminVersion: number; createdAt: number; expiresAt: number };
type EntryQuery = {
  sourceId?: string;
  q?: string;
  cursor?: string | null;
  limit?: number;
};

type ReaderStore = {
  addSource(input: { feedUrl: string; title?: string | null }, now: number): InternalSource;
  getSource(id: string): InternalSource | null;
  listSources(admin?: boolean): ReaderSource[];
  updateSource(
    id: string,
    patch: { title?: string | null; enabled?: boolean },
    now: number,
  ): InternalSource;
  deleteSource(id: string): boolean;
  dueSources(now: number): InternalSource[];
  claimSource(id: string, now: number, force?: boolean): InternalSource | null;
  completeSource(id: string, token: string | null, result: Completion, now: number): boolean;
  failSource(
    id: string,
    token: string | null,
    failure: { code?: string; retryAfterMs?: number },
    now: number,
  ): boolean;
  releaseSource(id: string, token: string | null): boolean;
  clearEntries(id: string, now: number): boolean;
  listEntries(options?: EntryQuery): ReaderEntries;
  getEntry(id: string): ReaderDetail | null;
  getAdmin(): { passwordHash: string; version: number } | null;
  setAdminPassword(passwordHash: string): number;
  createSession(input: { tokenHash: string; expiresAt: number }, now: number): Session;
  getSession(tokenHash: string, now: number): Session | null;
  deleteSession(tokenHash: string): boolean;
  cleanupSessions(now: number): number;
  backupTo(destination: string): Promise<void>;
  close(): void;
};

const openReaderStore = openStoreModule as unknown as (filename: string) => ReaderStore;

function tempDirectory(label: string) {
  return mkdtempSync(join(tmpdir(), `reader-store-${label}-`));
}

function entry(externalId: string, extra: Record<string, unknown> = {}) {
  return {
    externalId,
    title: `title ${externalId}`,
    url: `https://example.com/${externalId}`,
    author: null,
    publishedAt: null,
    contentKind: 'content',
    summaryHtml: `<p>${externalId}</p>`,
    contentHtml: `<p>${externalId} body</p>`,
    truncated: false,
    ...extra,
  };
}

function feed(entries: unknown[], extra: Record<string, unknown> = {}): Feed {
  return { title: 'Example feed', siteUrl: 'https://example.com', entries, ...extra };
}

/** Reads one value through a separate connection, to check what actually reached the file. */
function directValue(path: string, sql: string, ...parameters: (string | number)[]): unknown {
  const db = new DatabaseSync(path);
  try {
    const row = db.prepare(sql).get(...parameters);
    return row ? Object.values(row)[0] : undefined;
  } finally {
    db.close();
  }
}

function failure(work: () => unknown) {
  try {
    work();
  } catch (error) {
    return error as { code?: string; status?: number };
  }
  throw new Error('the call was expected to throw');
}

async function asyncFailure(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    return error as { code?: string; status?: number };
  }
  throw new Error('the call was expected to fail');
}

test('a new store creates private files and reopens with everything it kept', () => {
  const directory = tempDirectory('durable');
  const path = join(directory, 'nested', 'deep', 'reader.db');
  const now = 1_000_000;
  let store = openReaderStore(path);
  try {
    assert.equal(statSync(join(directory, 'nested', 'deep')).mode & 0o777, 0o700);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, now);
    const claim = store.claimSource(source.id, now);
    assert.ok(claim);
    const stored = store.completeSource(
      source.id,
      claim.leaseToken,
      { feed: feed([entry('a'), entry('b')]), etag: 'E1' },
      now,
    );
    assert.equal(stored, true);
    assert.equal(directValue(path, 'PRAGMA user_version'), 1);
    assert.equal(directValue(path, 'PRAGMA journal_mode'), 'wal');
    // The journal SQLite adds next to a wal database is private too.
    assert.equal(statSync(`${path}-wal`).mode & 0o777, 0o600);
  } finally {
    store.close();
  }

  store = openReaderStore(path);
  try {
    const sources = store.listSources(true) as ReaderAdminSource[];
    assert.equal(sources.length, 1);
    assert.equal(sources[0].feedUrl, 'https://one.example.com/feed.xml');
    assert.equal(sources[0].entryCount, 2);
    assert.equal(sources[0].status, 'ok');
    // Validators belong to the fetch cycle and stay out of every list projection.
    assert.equal(store.getSource(sources[0].id)?.etag, 'E1');
    assert.equal(store.listEntries({}).entries.length, 2);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an in-memory store keeps its data off the filesystem', () => {
  const store = openReaderStore(':memory:');
  try {
    const source = store.addSource({ feedUrl: 'https://memory.example.com/feed.xml' }, 5);
    const claim = store.claimSource(source.id, 5);
    assert.ok(claim);
    store.completeSource(source.id, claim.leaseToken, { feed: feed([entry('a')]) }, 5);
    assert.equal(store.listSources().length, 1);
    assert.equal(store.listEntries({}).entries.length, 1);
  } finally {
    store.close();
  }
  assert.equal(existsSync(resolve(':memory:')), false);
});

test('an unknown or damaged database file is refused and left byte for byte', () => {
  const directory = tempDirectory('refuse');
  const foreign = join(directory, 'foreign.db');
  const stranger = new DatabaseSync(foreign);
  stranger.exec('CREATE TABLE keep (value TEXT)');
  stranger.prepare('INSERT INTO keep VALUES (?)').run('not ours');
  stranger.close();
  const foreignBefore = readFileSync(foreign);
  const refused = failure(() => openReaderStore(foreign));
  assert.equal(refused.code, 'STORE_INVALID');
  assert.equal(refused.status, 500);
  assert.deepEqual(readFileSync(foreign), foreignBefore);
  const kept = new DatabaseSync(foreign);
  assert.equal(kept.prepare('SELECT value FROM keep').get()?.value, 'not ours');
  kept.close();

  const future = join(directory, 'future.db');
  const versioned = new DatabaseSync(future);
  versioned.exec('PRAGMA user_version = 99');
  versioned.close();
  const futureBefore = readFileSync(future);
  assert.equal(failure(() => openReaderStore(future)).code, 'STORE_INVALID');
  assert.deepEqual(readFileSync(future), futureBefore);

  const damaged = join(directory, 'damaged.db');
  writeFileSync(damaged, 'this is not a database, it is a note to self that is long enough');
  const damagedBefore = readFileSync(damaged);
  assert.equal(failure(() => openReaderStore(damaged)).code, 'STORE_INVALID');
  assert.deepEqual(readFileSync(damaged), damagedBefore);

  // An existing but empty file is an empty store, not a stranger: it may be initialised in place.
  const empty = join(directory, 'empty.db');
  writeFileSync(empty, '');
  const store = openReaderStore(empty);
  try {
    assert.equal(
      store.addSource({ feedUrl: 'https://empty.example.com/feed.xml' }, 1).title,
      'empty.example.com',
    );
    assert.equal(directValue(empty, 'PRAGMA user_version'), 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a source title prefers the user label, then the feed title, then the host', () => {
  const store = openReaderStore(':memory:');
  try {
    const source = store.addSource({ feedUrl: 'https://news.example.com/atom.xml' }, 1);
    assert.equal(source.title, 'news.example.com');
    const claim = store.claimSource(source.id, 1);
    assert.ok(claim);
    store.completeSource(
      source.id,
      claim.leaseToken,
      { feed: feed([entry('a')], { title: 'Example News' }) },
      1,
    );
    assert.equal(store.getSource(source.id)?.title, 'Example News');
    assert.equal(store.listEntries({}).entries[0].sourceTitle, 'Example News');
    assert.equal(store.updateSource(source.id, { title: 'My news' }, 2).title, 'My news');
    assert.equal(store.listEntries({}).entries[0].sourceTitle, 'My news');
    // A blank label falls back instead of blanking the row.
    assert.equal(store.updateSource(source.id, { title: '   ' }, 3).title, 'Example News');
  } finally {
    store.close();
  }
});

test('entry identity follows the GUID, so a shared link and a shared GUID stay apart', () => {
  const store = openReaderStore(':memory:');
  try {
    const one = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 10);
    const two = store.addSource({ feedUrl: 'https://two.example.com/feed.xml' }, 10);
    const sharedLink = 'https://example.com/same-story';
    const first = store.claimSource(one.id, 10);
    assert.ok(first);
    store.completeSource(
      one.id,
      first.leaseToken,
      {
        feed: feed([entry('guid-a', { url: sharedLink }), entry('guid-b', { url: sharedLink })]),
      },
      10,
    );
    const second = store.claimSource(two.id, 10);
    assert.ok(second);
    store.completeSource(
      two.id,
      second.leaseToken,
      { feed: feed([entry('guid-a', { url: sharedLink })], { title: 'Two News' }) },
      10,
    );

    const fromOne = store.listEntries({ sourceId: one.id }).entries;
    assert.equal(fromOne.length, 2);
    assert.deepEqual(
      fromOne.map((item) => item.url),
      [sharedLink, sharedLink],
    );
    const fromTwo = store.listEntries({ sourceId: two.id }).entries;
    assert.equal(fromTwo.length, 1);
    assert.equal(fromTwo[0].sourceTitle, 'Two News');
    assert.equal(store.listEntries({}).entries.length, 3);
    assert.notEqual(fromOne[0].id, fromTwo[0].id);
  } finally {
    store.close();
  }
});

test('a repeated GUID updates one row and keeps the time it was first collected', () => {
  const store = openReaderStore(':memory:');
  try {
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 100);
    const first = store.claimSource(source.id, 100);
    assert.ok(first);
    store.completeSource(
      source.id,
      first.leaseToken,
      { feed: feed([entry('story', { publishedAt: 50 })]) },
      100,
    );
    const [collected] = store.listEntries({}).entries;
    assert.equal(collected.collectedAt, 100);

    const secondAt = 100 + LIMITS.intervalMs; // a success waits a whole interval before the next try
    const second = store.claimSource(source.id, secondAt);
    assert.ok(second);
    store.completeSource(
      source.id,
      second.leaseToken,
      {
        feed: feed([
          entry('story', { title: 'rewritten', publishedAt: 900 }),
          entry('story', { title: 'last one wins' }),
        ]),
      },
      secondAt,
    );

    const entries = store.listEntries({}).entries;
    assert.equal(entries.length, 1); // the duplicate inside one package collapsed
    assert.equal(entries[0].id, collected.id);
    assert.equal(entries[0].collectedAt, 100); // untouched by the update
    assert.equal(entries[0].updatedAt, secondAt);
    assert.equal(entries[0].title, 'last one wins'); // the last entry of the package wins
    assert.equal(entries[0].publishedAt, null);
  } finally {
    store.close();
  }
});

test('a 304 and a failure keep the entries, the validators and the last success', () => {
  const store = openReaderStore(':memory:');
  try {
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 1_000);
    const first = store.claimSource(source.id, 1_000);
    assert.ok(first);
    store.completeSource(
      source.id,
      first.leaseToken,
      { feed: feed([entry('a'), entry('b')]), etag: 'E1', lastModified: 'L1' },
      1_000,
    );

    const maybeUnchangedAt = 1_000 + LIMITS.intervalMs;
    const unchanged = store.claimSource(source.id, maybeUnchangedAt - 1);
    assert.equal(unchanged, null); // a source that is not due cannot be claimed
    const unchangedClaim = store.claimSource(source.id, maybeUnchangedAt);
    assert.ok(unchangedClaim);
    assert.equal(
      store.completeSource(
        source.id,
        unchangedClaim.leaseToken,
        { notModified: true },
        maybeUnchangedAt,
      ),
      true,
    );
    const after304 = store.getSource(source.id);
    assert.ok(after304);
    assert.equal(after304.status, 'ok');
    assert.equal(after304.etag, 'E1');
    assert.equal(after304.lastModified, 'L1');
    assert.equal(after304.lastSuccessAt, maybeUnchangedAt);
    assert.equal(after304.nextFetchAt, maybeUnchangedAt + LIMITS.intervalMs);
    assert.equal(after304.entryCount, 2);
    assert.equal(after304.failureCount, 0);
    assert.equal(after304.leaseToken, null);

    const failingAt = maybeUnchangedAt + LIMITS.intervalMs;
    const third = store.claimSource(source.id, failingAt);
    assert.ok(third);
    assert.equal(
      store.failSource(
        source.id,
        third.leaseToken,
        { code: 'timeout!', retryAfterMs: 5_000 },
        failingAt,
      ),
      true,
    );
    const failed = store.getSource(source.id);
    assert.ok(failed);
    assert.equal(failed.status, 'error');
    assert.equal(failed.errorCode, 'FETCH_FAILED'); // only bounded codes are stored
    assert.equal(failed.failureCount, 1);
    assert.equal(failed.etag, 'E1');
    assert.equal(failed.lastModified, 'L1');
    assert.equal(failed.lastSuccessAt, maybeUnchangedAt);
    assert.equal(failed.entryCount, 2);
    assert.equal(failed.leaseToken, null);
    assert.equal(failed.nextFetchAt, failingAt + Math.max(RETRY_MS[0], 5_000));

    // The retry delay grows step by step and stops growing at the last step.
    let at = failingAt + Math.max(RETRY_MS[0], 5_000);
    for (let attempt = 2; attempt <= RETRY_MS.length + 2; attempt += 1) {
      const claim = store.claimSource(source.id, at);
      assert.ok(claim);
      store.failSource(source.id, claim.leaseToken, {}, at);
      const delay = RETRY_MS[Math.min(attempt - 1, RETRY_MS.length - 1)];
      assert.equal(store.getSource(source.id)?.nextFetchAt, at + delay);
      at += LIMITS.intervalMs;
    }
    assert.equal(store.getSource(source.id)?.failureCount, RETRY_MS.length + 2);

    const long = store.claimSource(source.id, at);
    assert.ok(long);
    store.failSource(source.id, long.leaseToken, { code: 'A'.repeat(41) }, at);
    assert.equal(store.getSource(source.id)?.errorCode, 'FETCH_FAILED');
    const bounded = store.claimSource(source.id, at + LIMITS.intervalMs);
    assert.ok(bounded);
    store.failSource(
      source.id,
      bounded.leaseToken,
      { code: 'A'.repeat(40) },
      at + LIMITS.intervalMs,
    );
    assert.equal(store.getSource(source.id)?.errorCode, 'A'.repeat(40));
  } finally {
    store.close();
  }
});

test('deleting a source takes its entries with it', () => {
  const directory = tempDirectory('cascade');
  const path = join(directory, 'reader.db');
  const store = openReaderStore(path);
  try {
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 1);
    const claim = store.claimSource(source.id, 1);
    assert.ok(claim);
    store.completeSource(source.id, claim.leaseToken, { feed: feed([entry('a'), entry('b')]) }, 1);
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM entries'), 2);
    assert.equal(store.deleteSource(source.id), true);
    assert.equal(store.deleteSource(source.id), false);
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM entries'), 0);
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM sources'), 0);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the entry budget rolls the whole success back, validators and success time included', () => {
  const store = openReaderStore(':memory:');
  try {
    const at = 1_000;
    const full = store.addSource({ feedUrl: 'https://full.example.com/feed.xml' }, at);
    const claimFull = store.claimSource(full.id, at);
    assert.ok(claimFull);
    const many = Array.from({ length: LIMITS.entries }, (_, index) => entry(`e${index}`));
    assert.equal(
      store.completeSource(full.id, claimFull.leaseToken, { feed: feed(many) }, at),
      true,
    );
    assert.equal(store.getSource(full.id)?.entryCount, LIMITS.entries);

    const late = store.addSource({ feedUrl: 'https://late.example.com/feed.xml' }, at);
    const claimLate = store.claimSource(late.id, at);
    assert.ok(claimLate);
    const refused = failure(() =>
      store.completeSource(
        late.id,
        claimLate.leaseToken,
        { feed: feed([entry('overflow')]), etag: 'E2' },
        at,
      ),
    );
    assert.equal(refused.code, 'CAPACITY');
    assert.equal(refused.status, 409);

    // Nothing moved: no entry, no validator, no success time, and the claim is still the live one.
    const untouched = store.getSource(late.id);
    assert.ok(untouched);
    assert.equal(untouched.entryCount, 0);
    assert.equal(untouched.etag, null);
    assert.equal(untouched.lastSuccessAt, null);
    assert.equal(untouched.lastAttemptAt, at);
    assert.equal(untouched.leaseToken, claimLate.leaseToken);
    assert.equal(untouched.status, 'fetching');
    assert.equal(store.getSource(full.id)?.entryCount, LIMITS.entries);

    // A package that brings nothing new is not an overflow, and neither is redelivering the same ids.
    assert.equal(
      store.completeSource(late.id, claimLate.leaseToken, { feed: feed([]), etag: 'E2' }, at + 1),
      true,
    );
    assert.equal(store.getSource(late.id)?.etag, 'E2');
    assert.equal(store.getSource(late.id)?.lastSuccessAt, at + 1);
    const nextAttempt = at + LIMITS.intervalMs; // the successful harvest scheduled the next one
    const notYet = store.claimSource(full.id, nextAttempt - 1);
    assert.equal(notYet, null);
    const again = store.claimSource(full.id, nextAttempt);
    assert.ok(again);
    assert.equal(
      store.completeSource(full.id, again.leaseToken, { feed: feed(many) }, nextAttempt),
      true,
    );
    assert.equal(store.getSource(full.id)?.entryCount, LIMITS.entries);
  } finally {
    store.close();
  }
});

test('pagination walks equal timestamps by id and refuses a broken cursor', () => {
  const store = openReaderStore(':memory:');
  try {
    const source = store.addSource({ feedUrl: 'https://page.example.com/feed.xml' }, 10);
    const claim = store.claimSource(source.id, 10);
    assert.ok(claim);
    const stories = Array.from({ length: 7 }, (_, index) => entry(`p${index}`));
    store.completeSource(source.id, claim.leaseToken, { feed: feed(stories) }, 10);

    const all = store.listEntries({});
    assert.equal(all.entries.length, 7);
    assert.equal(all.nextCursor, null);
    const expected = all.entries
      .map((item) => item.id)
      .sort()
      .reverse(); // id DESC breaks the tie
    assert.deepEqual(
      all.entries.map((item) => item.id),
      expected,
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const result: ReaderEntries = store.listEntries({ cursor, limit: 2 });
      seen.push(...result.entries.map((item) => item.id));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    assert.equal(cursor, null);
    assert.deepEqual(seen, expected);

    assert.equal(store.listEntries({ limit: 0 }).entries.length, 1); // a page is at least one row
    assert.equal(store.listEntries({ limit: 100 }).entries.length, 7);
    assert.equal(store.listEntries({ limit: -4 }).entries.length, 1);

    // Everything sorts after the smallest possible key, so nothing is left behind it.
    const beforeAll = Buffer.from(JSON.stringify([10, '0'.repeat(64)]), 'utf8').toString(
      'base64url',
    );
    assert.deepEqual(store.listEntries({ cursor: beforeAll }), { entries: [], nextCursor: null });

    const broken = [
      'not a cursor',
      Buffer.from(JSON.stringify([1]), 'utf8').toString('base64url'),
      Buffer.from(JSON.stringify(['a', 'b']), 'utf8').toString('base64url'),
      Buffer.from(JSON.stringify([1.5, 'a'.repeat(64)]), 'utf8').toString('base64url'),
      Buffer.from(JSON.stringify([1, 'A'.repeat(64)]), 'utf8').toString('base64url'),
      Buffer.from(JSON.stringify([1, 'a'.repeat(63)]), 'utf8').toString('base64url'),
    ];
    for (const value of broken) {
      const refused = failure(() => store.listEntries({ cursor: value }));
      assert.equal(refused.code, 'INVALID_CURSOR');
      assert.equal(refused.status, 400);
    }
  } finally {
    store.close();
  }
});

test('the list filters by source and escapes the wildcards in the query', () => {
  const store = openReaderStore(':memory:');
  try {
    const one = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 1);
    const two = store.addSource({ feedUrl: 'https://two.example.com/feed.xml' }, 1);
    const claimOne = store.claimSource(one.id, 1);
    assert.ok(claimOne);
    store.completeSource(
      one.id,
      claimOne.leaseToken,
      {
        feed: feed([
          entry('percent', { title: '100% done', summaryHtml: '<p>first</p>' }),
          entry('wildcard-underscore', { title: 'a_b', summaryHtml: '<p>second</p>' }),
          entry('decoy-underscore', { title: 'aXb', summaryHtml: '<p>third</p>' }),
          entry('wildcard-percent', { title: 'v%v', summaryHtml: '<p>fourth</p>' }),
          entry('decoy-percent', { title: 'vXv', summaryHtml: '<p>fifth</p>' }),
          entry('backslash', { title: 'c\\d', summaryHtml: '<p>sixth</p>' }),
          entry('summary-only', { title: 'quiet', summaryHtml: '<p>a needle in the summary</p>' }),
        ]),
      },
      1,
    );
    const claimTwo = store.claimSource(two.id, 1);
    assert.ok(claimTwo);
    store.completeSource(
      two.id,
      claimTwo.leaseToken,
      { feed: feed([entry('other', { title: 'a_b', summaryHtml: '<p>other</p>' })]) },
      1,
    );

    const found = (options: EntryQuery) =>
      store
        .listEntries(options)
        .entries.map((item) => item.title)
        .sort();
    assert.deepEqual(found({ q: '%' }), ['100% done', 'v%v']);
    assert.deepEqual(found({ q: 'a_b' }), ['a_b', 'a_b']);
    assert.deepEqual(found({ q: 'v%v' }), ['v%v']);
    assert.deepEqual(found({ q: '\\' }), ['c\\d']);
    assert.deepEqual(found({ q: 'needle' }), ['quiet']); // the summary is searched too
    assert.deepEqual(found({ q: 'a_b', sourceId: two.id }), ['a_b']);
    assert.equal(found({ sourceId: one.id }).length, 7);
    assert.deepEqual(store.listEntries({ sourceId: 'missing' }), { entries: [], nextCursor: null });

    const long = failure(() => store.listEntries({ q: 'x'.repeat(101) }));
    assert.equal(long.code, 'INVALID_QUERY');
    assert.equal(long.status, 400);

    const list = store.listEntries({});
    assert.equal('contentHtml' in list.entries[0], false);
    assert.equal(list.entries[0].summaryHtml.length > 0, true);
    const detail: ReaderDetail | null = store.getEntry(list.entries[0].id);
    assert.ok(detail);
    assert.equal(detail.contentHtml.length > 0, true);
    assert.equal(store.getEntry('no-such-entry'), null);
  } finally {
    store.close();
  }
});

test('a claim needs a due, unheld source, while force skips the due time but not a live lease', () => {
  const store = openReaderStore(':memory:');
  try {
    const at = 10_000;
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, at);
    assert.deepEqual(
      store.dueSources(at - 1).map((item) => item.id),
      [],
    );
    assert.equal(store.claimSource(source.id, at - 1), null); // a source that is not due is not claimable
    assert.deepEqual(
      store.dueSources(at).map((item) => item.id),
      [source.id],
    );

    const first = store.claimSource(source.id, at);
    assert.ok(first);
    assert.equal(first.status, 'fetching');
    assert.equal(first.lastAttemptAt, at);
    assert.equal(first.leaseUntil, at + LIMITS.leaseMs);
    assert.equal(first.nextFetchAt, at); // a claim never brings the next attempt forward
    assert.deepEqual(
      store.dueSources(at).map((item) => item.id),
      [],
    );
    assert.equal(store.claimSource(source.id, at), null); // already held
    assert.equal(store.claimSource(source.id, at, true), null); // force does not take a live lease

    const expiredAt = at + LIMITS.leaseMs + 1;
    const expired = store.claimSource(source.id, expiredAt);
    assert.ok(expired);
    assert.notEqual(expired.leaseToken, first.leaseToken);
    assert.equal(expired.leaseUntil, expiredAt + LIMITS.leaseMs);
    assert.equal(
      store.completeSource(source.id, first.leaseToken, { feed: feed([entry('late')]) }, expiredAt),
      false,
    );
    assert.equal(store.getSource(source.id)?.entryCount, 0); // a stale token changes nothing
    assert.equal(store.getSource(source.id)?.status, 'fetching');
    assert.equal(store.getSource(source.id)?.etag, null);
    // The second lease is live as well, so neither a plain nor a forced claim may take it.
    assert.equal(store.claimSource(source.id, expiredAt + 1), null);
    assert.equal(store.claimSource(source.id, expiredAt + 1, true), null);

    const thirdAt = expired.leaseUntil!;
    const third = store.claimSource(source.id, thirdAt); // the second lease has run out
    assert.ok(third);
    assert.equal(
      store.completeSource(
        source.id,
        expired.leaseToken,
        { feed: feed([entry('stale')]) },
        thirdAt,
      ),
      false,
    );
    assert.equal(
      store.completeSource(source.id, third.leaseToken, { feed: feed([entry('fresh')]) }, thirdAt),
      true,
    );
    const stored = store.getSource(source.id);
    assert.equal(stored?.entryCount, 1);
    assert.equal(stored?.status, 'ok');
    const dueAt = thirdAt + LIMITS.intervalMs;
    assert.equal(stored?.nextFetchAt, dueAt);
    assert.deepEqual(
      store.dueSources(dueAt).map((item) => item.id),
      [source.id],
    );
    assert.equal(store.claimSource(source.id, dueAt - 1), null); // not due yet

    const forced = store.claimSource(source.id, dueAt - 1, true); // force skips the due time only
    assert.ok(forced);
    assert.equal(forced.nextFetchAt, dueAt); // an early attempt leaves the schedule alone
    assert.equal(store.claimSource(source.id, dueAt - 1, true), null); // then its own lease holds it

    // A release hands the attempt back without moving the due time, so a restart picks it up.
    assert.equal(store.releaseSource(source.id, 'not-the-token'), false);
    assert.equal(store.releaseSource(source.id, forced.leaseToken), true);
    const released = store.getSource(source.id);
    assert.equal(released?.status, 'ok');
    assert.equal(released?.leaseToken, null);
    assert.equal(released?.nextFetchAt, dueAt);
    assert.deepEqual(
      store.dueSources(dueAt - 1).map((item) => item.id),
      [],
    );
    assert.deepEqual(
      store.dueSources(dueAt).map((item) => item.id),
      [source.id],
    );
    assert.equal(store.releaseSource(source.id, forced.leaseToken), false);

    const fresh = store.addSource({ feedUrl: 'https://fresh.example.com/feed.xml' }, at);
    const heldFresh = store.claimSource(fresh.id, at);
    assert.ok(heldFresh);
    assert.equal(store.releaseSource(fresh.id, heldFresh.leaseToken), true);
    assert.equal(store.getSource(fresh.id)?.status, 'pending'); // nothing succeeded yet
  } finally {
    store.close();
  }
});

test('a disabled source stops being claimable and a late or deleted fetch changes nothing', () => {
  const store = openReaderStore(':memory:');
  try {
    const at = 500;
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, at);
    const claim = store.claimSource(source.id, at);
    assert.ok(claim);

    const disabled = store.updateSource(source.id, { enabled: false }, at + 1);
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.status, 'paused');
    assert.equal(disabled.leaseToken, null);
    assert.deepEqual(
      store.dueSources(at + 1).map((item) => item.id),
      [],
    );
    assert.equal(store.claimSource(source.id, at + 1), null);
    assert.equal(store.claimSource(source.id, at + 1, true), null); // force does not wake a paused feed
    assert.equal(
      store.completeSource(source.id, claim.leaseToken, { feed: feed([entry('late')]) }, at + 1),
      false,
    );
    assert.equal(store.failSource(source.id, claim.leaseToken, {}, at + 1), false);
    assert.equal(store.releaseSource(source.id, claim.leaseToken), false);
    assert.equal(store.getSource(source.id)?.entryCount, 0);

    const restarted = store.updateSource(source.id, { enabled: true }, at + 2);
    assert.equal(restarted.enabled, true);
    assert.equal(restarted.status, 'pending');
    assert.equal(restarted.nextFetchAt, at + 2);
    assert.deepEqual(
      store.dueSources(at + 2).map((item) => item.id),
      [source.id],
    );
    assert.equal(
      store.completeSource(source.id, claim.leaseToken, { feed: feed([entry('stale')]) }, at + 2),
      false,
    );

    const current = store.claimSource(source.id, at + 2);
    assert.ok(current);
    assert.equal(
      store.completeSource(source.id, current.leaseToken, { feed: feed([entry('kept')]) }, at + 2),
      true,
    );

    assert.equal(store.deleteSource(source.id), true);
    assert.equal(store.getSource(source.id), null);
    assert.equal(
      store.completeSource(source.id, current.leaseToken, { feed: feed([entry('ghost')]) }, at + 3),
      false,
    );
    assert.equal(store.releaseSource(source.id, current.leaseToken), false);
    assert.deepEqual(
      store.dueSources(at + 100_000).map((item) => item.id),
      [],
    );
    assert.deepEqual(store.listEntries({}), { entries: [], nextCursor: null });
  } finally {
    store.close();
  }
});

test('clearing a source drops its entries, validators and lease and re-arms the fetch', () => {
  const store = openReaderStore(':memory:');
  try {
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 1_000);
    const claim = store.claimSource(source.id, 1_000);
    assert.ok(claim);
    store.completeSource(
      source.id,
      claim.leaseToken,
      { feed: feed([entry('a'), entry('b')]), etag: 'E1', lastModified: 'L1' },
      1_000,
    );
    const failingAt = 1_000 + LIMITS.intervalMs;
    const failing = store.claimSource(source.id, failingAt);
    assert.ok(failing);
    store.failSource(source.id, failing.leaseToken, { code: 'TIMEOUT' }, failingAt);
    const retryAt = failingAt + RETRY_MS[0];
    const held = store.claimSource(source.id, retryAt);
    assert.ok(held);

    const clearedAt = retryAt + 1_000;
    assert.equal(store.clearEntries(source.id, clearedAt), true);
    const cleared = store.getSource(source.id);
    assert.ok(cleared);
    assert.equal(cleared.entryCount, 0);
    assert.equal(cleared.etag, null);
    assert.equal(cleared.lastModified, null);
    assert.equal(cleared.leaseToken, null);
    assert.equal(cleared.nextFetchAt, clearedAt);
    assert.equal(cleared.status, 'pending');
    assert.equal(cleared.feedUrl, 'https://one.example.com/feed.xml'); // the source stays
    assert.equal(cleared.failureCount, 1); // clearing a cache is not a success
    assert.equal(cleared.lastSuccessAt, 1_000);
    assert.equal(cleared.errorCode, 'TIMEOUT');
    assert.deepEqual(store.listEntries({}).entries, []);
    assert.equal(failure(() => store.clearEntries('no-such-source', clearedAt)).code, 'NOT_FOUND');

    assert.equal(store.updateSource(source.id, { enabled: false }, clearedAt + 1).status, 'paused');
    assert.equal(store.clearEntries(source.id, clearedAt + 2), true);
    assert.equal(store.getSource(source.id)?.status, 'paused');
  } finally {
    store.close();
  }
});

test('sources refuse duplicates and the fifty-first feed, and validate what they accept', () => {
  const store = openReaderStore(':memory:');
  try {
    const first = store.addSource(
      { feedUrl: 'https://one.example.com/feed.xml', title: '  Mine  ' },
      7,
    );
    assert.equal(first.title, 'Mine'); // a label is trimmed
    assert.equal(first.status, 'pending');
    assert.equal(first.enabled, true);
    assert.equal(first.nextFetchAt, 7);
    assert.equal(first.failureCount, 0);
    assert.equal(first.etag, null);
    assert.equal(
      store.addSource({ feedUrl: 'https://two.example.com/feed.xml', title: 'x'.repeat(121) }, 7)
        .title,
      'two.example.com', // an over-long label is dropped, not stored
    );
    assert.equal(
      store.addSource({ feedUrl: 'https://three.example.com/feed.xml', title: '   ' }, 7).title,
      'three.example.com',
    );
    assert.equal(
      store.addSource({ feedUrl: 'https://four.example.com/feed.xml' }, 7).title,
      'four.example.com',
    );

    assert.equal(
      failure(() => store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 7)).code,
      'SOURCE_EXISTS',
    );
    const wrong = [
      'ftp://one.example.com/feed.xml',
      'https://user:pass@one.example.com/feed.xml',
      'one.example.com/feed.xml',
      `https://one.example.com/${'x'.repeat(2048)}`,
    ];
    for (const feedUrl of wrong) {
      const invalid = failure(() => store.addSource({ feedUrl }, 7));
      assert.equal(invalid.code, 'INVALID_SOURCE');
      assert.equal(invalid.status, 400);
    }

    for (let index = 1; index < LIMITS.sources - 3; index += 1) {
      store.addSource({ feedUrl: `https://bulk${index}.example.com/rss.xml` }, 7);
    }
    assert.equal(store.listSources().length, LIMITS.sources);
    assert.equal(store.listSources()[0].id, first.id); // configuration order
    assert.equal(
      failure(() => store.addSource({ feedUrl: 'https://overflow.example.com/rss.xml' }, 7)).code,
      'SOURCE_LIMIT',
    );
    assert.equal(
      failure(() => store.addSource({ feedUrl: first.feedUrl ?? '' }, 7)).code,
      'SOURCE_EXISTS',
    );

    const publicList: ReaderSource[] = store.listSources();
    assert.equal(
      Object.keys(publicList[0]).join(','),
      'id,title,siteUrl,enabled,status,lastAttemptAt,lastSuccessAt,nextFetchAt,errorCode,entryCount',
    );
    const adminList = store.listSources(true) as ReaderAdminSource[];
    assert.equal(
      Object.keys(adminList[0]).join(','),
      'id,title,siteUrl,enabled,status,lastAttemptAt,lastSuccessAt,nextFetchAt,errorCode,entryCount,feedUrl,failureCount',
    );

    assert.equal(store.updateSource(first.id, { title: 'Renamed' }, 8).title, 'Renamed');
    for (const patch of [{}, { unknown: true }, { enabled: 'yes' }]) {
      const invalid = failure(() => store.updateSource(first.id, patch as never, 8));
      assert.equal(invalid.code, 'INVALID_SOURCE');
      assert.equal(invalid.status, 400);
    }
    assert.equal(
      failure(() => store.updateSource('no-such-source', { enabled: false }, 8)).code,
      'NOT_FOUND',
    );
    assert.equal(store.updateSource(first.id, { title: null }, 9).title, 'one.example.com');
  } finally {
    store.close();
  }
});

test('sessions expire, obey the five-slot budget and die with the password', () => {
  const directory = tempDirectory('sessions');
  const path = join(directory, 'reader.db');
  const store = openReaderStore(path);
  try {
    assert.equal(store.getAdmin(), null);
    const unconfigured = failure(() => store.createSession({ tokenHash: 't', expiresAt: 100 }, 0));
    assert.equal(unconfigured.code, 'ADMIN_UNCONFIGURED');
    assert.equal(unconfigured.status, 503);

    assert.equal(store.setAdminPassword('hash-one'), 1);
    assert.deepEqual(store.getAdmin(), { passwordHash: 'hash-one', version: 1 });
    const tokens: string[] = [];
    for (let index = 0; index <= LIMITS.sessions; index += 1) {
      tokens.push(
        store.createSession({ tokenHash: `token-${index}`, expiresAt: 2_000_000 }, 100 + index)
          .tokenHash,
      );
    }
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM sessions'), LIMITS.sessions);
    assert.equal(store.getSession(tokens[0], 200), null); // the oldest slot was freed
    assert.equal(store.getSession(tokens[1], 200)?.adminVersion, 1);
    assert.equal(store.getSession(tokens[LIMITS.sessions], 200)?.createdAt, 100 + LIMITS.sessions);
    assert.equal(store.getSession('token-unknown', 200), null);

    // Expiry is reported without writing, so a plain read leaves the row for the next cleanup.
    assert.equal(store.getSession(tokens[1], 2_000_000), null);
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM sessions'), LIMITS.sessions);
    assert.equal(store.cleanupSessions(1_999_999), 0);
    assert.equal(store.cleanupSessions(2_000_000), LIMITS.sessions);
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM sessions'), 0);

    // The table keeps one hash per session and no other token material.
    assert.equal(
      directValue(
        path,
        "SELECT count(*) AS total FROM pragma_table_info('sessions') WHERE name LIKE '%token%'",
      ),
      1,
    );
    assert.equal(
      directValue(
        path,
        "SELECT count(*) AS total FROM pragma_table_info('sessions') WHERE name = 'token_hash'",
      ),
      1,
    );

    assert.equal(
      store.createSession({ tokenHash: 'token-last', expiresAt: 3_000_000 }, 2_100_000).tokenHash,
      'token-last',
    );
    assert.equal(store.deleteSession('token-last'), true);
    assert.equal(store.deleteSession('token-last'), false);

    assert.equal(store.setAdminPassword('hash-two'), 2);
    assert.deepEqual(store.getAdmin(), { passwordHash: 'hash-two', version: 2 });
    assert.equal(store.getSession('token-last', 2_100_001), null); // the password change revoked it
    assert.equal(directValue(path, 'SELECT count(*) AS total FROM sessions'), 0);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a backup reopens as a complete store while an existing or linked target is refused', async () => {
  const directory = tempDirectory('backup');
  const path = join(directory, 'reader.db');
  const copy = join(directory, 'copy.db');
  const store = openReaderStore(path);
  try {
    const source = store.addSource({ feedUrl: 'https://one.example.com/feed.xml' }, 1);
    const claim = store.claimSource(source.id, 1);
    assert.ok(claim);
    store.completeSource(source.id, claim.leaseToken, { feed: feed([entry('a')]), etag: 'E1' }, 1);
    await store.backupTo(copy);
    assert.equal(statSync(copy).mode & 0o777, 0o600);

    const restored = openReaderStore(copy);
    try {
      assert.equal(directValue(copy, 'PRAGMA user_version'), 1);
      const [restoredSource] = restored.listSources(true) as ReaderAdminSource[];
      assert.equal(restoredSource.feedUrl, 'https://one.example.com/feed.xml');
      assert.equal(restored.getSource(restoredSource.id)?.etag, 'E1');
      assert.equal(restored.listEntries({}).entries.length, 1);
    } finally {
      restored.close();
    }

    const current = readFileSync(copy);
    assert.equal((await asyncFailure(() => store.backupTo(copy))).code, 'BACKUP_EXISTS');
    assert.deepEqual(readFileSync(copy), current);

    const victim = join(directory, 'victim.db');
    writeFileSync(victim, 'a user file that a link points at');
    const link = join(directory, 'link.db');
    symlinkSync(victim, link);
    assert.equal((await asyncFailure(() => store.backupTo(link))).code, 'BACKUP_EXISTS');
    assert.equal(readFileSync(victim, 'utf8'), 'a user file that a link points at');

    const missing = join(directory, 'nowhere', 'copy.db');
    await assert.rejects(() => store.backupTo(missing));
    assert.equal(existsSync(missing), false);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a backup that fails removes only the file it just created', async () => {
  const directory = tempDirectory('backup-failure');
  const store = openReaderStore(join(directory, 'reader.db'));
  const target = join(directory, 'half.db');
  store.close();
  await assert.rejects(() => store.backupTo(target));
  assert.equal(existsSync(target), false);
  rmSync(directory, { recursive: true, force: true });
});

test('closing twice is safe and the store keeps its connection to itself', () => {
  const store = openReaderStore(':memory:');
  assert.deepEqual(Object.keys(store).sort(), [
    'addSource',
    'backupTo',
    'claimSource',
    'cleanupSessions',
    'clearEntries',
    'close',
    'completeSource',
    'createSession',
    'deleteSession',
    'deleteSource',
    'dueSources',
    'failSource',
    'getAdmin',
    'getEntry',
    'getSession',
    'getSource',
    'listEntries',
    'listSources',
    'releaseSource',
    'setAdminPassword',
    'updateSource',
  ]);
  assert.equal(Object.hasOwn(store, 'db'), false);
  assert.equal(Object.hasOwn(store, 'filename'), false);
  store.close();
  store.close();
});
