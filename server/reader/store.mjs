/** Durable SQLite store for the feed reader: sources, harvested entries and one administrator.
 *
 * The connection stays private.  Every method returns either a projection of
 * `src/domain/reader.ts` or a boolean success flag; every statement is prepared once and every
 * value is bound, so no caller input reaches SQL text.  All timestamps are milliseconds and are
 * supplied by the caller instead of being read from the clock here.
 */
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, lstatSync, mkdirSync, openSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { LIMITS, RETRY_MS, ReaderError } from './model.mjs';

/** Bumped whenever the schema below changes; a file at any other version is reported, not touched. */
const SCHEMA_VERSION = 1;
const TABLES = ['admin', 'entries', 'sessions', 'sources'];
const MAX_FEED_URL = 2048;
const MAX_LABEL = 120;
const MAX_QUERY = 100;
const SOURCE_PATCH_KEYS = new Set(['title', 'enabled']);
const CONTENT_KINDS = new Set(['content', 'summary']);
const ENTRY_ID = /^[0-9a-f]{64}$/;
const ERROR_CODE = /^[A-Z_]{1,40}$/;

const SCHEMA_SQL = `
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  feed_url TEXT NOT NULL UNIQUE,
  label TEXT,
  feed_title TEXT,
  site_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  next_fetch_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  etag TEXT,
  last_modified TEXT,
  lease_token TEXT,
  lease_until INTEGER
);
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  author TEXT,
  published_at INTEGER,
  collected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  content_kind TEXT NOT NULL,
  summary_html TEXT NOT NULL,
  content_html TEXT NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source_id, external_id)
);
CREATE INDEX entries_source_sort
  ON entries (source_id, COALESCE(published_at, collected_at) DESC, id DESC);
CREATE TABLE admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  admin_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions (expires_at);
`;

/** Display order for one entry: the published date when the feed gave one, else when it arrived. */
const SORT_AT = 'COALESCE(e.published_at, e.collected_at)';
const SOURCE_COLUMNS = `s.id, s.feed_url, s.label, s.feed_title, s.site_url, s.enabled,
  s.last_attempt_at, s.last_success_at, s.next_fetch_at, s.status, s.error_code, s.failure_count,
  s.etag, s.last_modified, s.lease_token, s.lease_until,
  (SELECT count(*) FROM entries e WHERE e.source_id = s.id) AS entry_count`;
const ENTRY_COLUMNS = `e.id, e.source_id, e.external_id, e.title, e.url, e.author, e.published_at,
  e.collected_at, e.updated_at, e.content_kind, e.summary_html, e.content_html, e.truncated,
  ${SORT_AT} AS sort_at, s.label, s.feed_title, s.feed_url`;
const ENTRY_JOIN = 'FROM entries e JOIN sources s ON s.id = e.source_id';

const SQL = {
  countSources: 'SELECT count(*) AS total FROM sources',
  sourceById: `SELECT ${SOURCE_COLUMNS} FROM sources s WHERE s.id = ?`,
  sourceByUrl: 'SELECT s.id FROM sources s WHERE s.feed_url = ?',
  /** Configuration order, which is the order an administrator recognises. */
  listSources: `SELECT ${SOURCE_COLUMNS} FROM sources s ORDER BY s.rowid ASC`,
  dueSources: `SELECT ${SOURCE_COLUMNS} FROM sources s
    WHERE s.enabled = 1 AND s.next_fetch_at <= ? AND (s.lease_until IS NULL OR s.lease_until <= ?)
    ORDER BY s.next_fetch_at ASC, s.id ASC`,
  insertSource: `INSERT INTO sources (id, feed_url, label, enabled, status, next_fetch_at, failure_count)
    VALUES (?, ?, ?, 1, 'pending', ?, 0)`,
  deleteSource: 'DELETE FROM sources WHERE id = ?',
  claimSource: `UPDATE sources SET lease_token = ?, lease_until = ?, last_attempt_at = ?, status = 'fetching'
    WHERE id = ?`,
  /** A success replaces the feed metadata and the validators; a 304 keeps both. */
  completeSource: `UPDATE sources SET feed_title = ?, site_url = ?, etag = ?, last_modified = ?,
    status = 'ok', last_success_at = ?, next_fetch_at = ?, failure_count = 0, error_code = NULL,
    lease_token = NULL, lease_until = NULL WHERE id = ?`,
  completeUnchangedSource: `UPDATE sources SET status = 'ok', last_success_at = ?, next_fetch_at = ?,
    failure_count = 0, error_code = NULL, lease_token = NULL, lease_until = NULL WHERE id = ?`,
  /** A failure keeps the entries, the validators and the last success, and only schedules a retry. */
  failSource: `UPDATE sources SET failure_count = failure_count + 1, next_fetch_at = ?, status = 'error',
    error_code = ?, lease_token = NULL, lease_until = NULL WHERE id = ?`,
  releaseSource: `UPDATE sources SET lease_token = NULL, lease_until = NULL, status = ?
    WHERE id = ? AND lease_token = ?`,
  deleteSourceEntries: 'DELETE FROM entries WHERE source_id = ?',
  resetSourceCache: `UPDATE sources SET etag = NULL, last_modified = NULL, lease_token = NULL,
    lease_until = NULL, next_fetch_at = ?, status = ? WHERE id = ?`,
  countEntries: 'SELECT count(*) AS total FROM entries',
  entryExists: 'SELECT 1 AS found FROM entries WHERE source_id = ? AND external_id = ?',
  upsertEntry: `INSERT INTO entries (
      id, source_id, external_id, title, url, author, published_at, collected_at, updated_at,
      content_kind, summary_html, content_html, truncated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (source_id, external_id) DO UPDATE SET
      title = excluded.title,
      url = excluded.url,
      author = excluded.author,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at,
      content_kind = excluded.content_kind,
      summary_html = excluded.summary_html,
      content_html = excluded.content_html,
      truncated = excluded.truncated`,
  entryDetail: `SELECT ${ENTRY_COLUMNS} ${ENTRY_JOIN} WHERE e.id = ?`,
  countSessions: 'SELECT count(*) AS total FROM sessions',
  insertSession: `INSERT INTO sessions (token_hash, admin_version, created_at, expires_at)
    VALUES (?, ?, ?, ?)`,
  sessionByToken: `SELECT token_hash, admin_version, created_at, expires_at FROM sessions
    WHERE token_hash = ?`,
  deleteSession: 'DELETE FROM sessions WHERE token_hash = ?',
  deleteExpiredSessions: 'DELETE FROM sessions WHERE expires_at <= ?',
  /** Frees slots oldest first, with the token hash breaking ties created in the same millisecond. */
  deleteOldestSessions: `DELETE FROM sessions WHERE token_hash IN
    (SELECT token_hash FROM sessions ORDER BY created_at ASC, token_hash ASC LIMIT ?)`,
  admin: 'SELECT password_hash, version FROM admin WHERE id = 1',
  insertAdmin: 'INSERT INTO admin (id, password_hash, version) VALUES (1, ?, ?)',
  updateAdmin: 'UPDATE admin SET password_hash = ?, version = ? WHERE id = 1',
  deleteAllSessions: 'DELETE FROM sessions',
};

export function openReaderStore(filename) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new TypeError('openReaderStore needs a database filename');
  }
  const inMemory = filename === ':memory:';
  if (!inMemory) prepareDatabaseFile(filename);

  // A new database, its -wal and its -shm belong to their owner only.  SQLite copies the mode of
  // the database file onto the journal files it adds later, and the temporary umask covers the
  // files this process creates while opening.
  const previousUmask = process.umask(0o077);
  let db;
  try {
    db = new DatabaseSync(filename);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 2000');
    db.exec('PRAGMA synchronous = FULL');
    initializeSchema(db);
    if (!inMemory) db.exec('PRAGMA journal_mode = WAL');
  } catch (error) {
    closeQuietly(db);
    if (error instanceof ReaderError) throw error;
    // A file that cannot be read as a store is reported as it is, never deleted or overwritten.
    const failure = new ReaderError('STORE_INVALID', 500);
    failure.cause = error;
    throw failure;
  } finally {
    process.umask(previousUmask);
  }

  const statements = {};
  const compiled = new Map();
  try {
    for (const [name, sql] of Object.entries(SQL)) {
      const statement = db.prepare(sql);
      statements[name] = statement;
      compiled.set(sql, statement);
    }
  } catch {
    closeQuietly(db);
    throw unknownStore();
  }

  /** Reuses a prepared statement for SQL that is assembled from fixed fragments at call time. */
  function prepare(sql) {
    let statement = compiled.get(sql);
    if (!statement) {
      statement = db.prepare(sql);
      compiled.set(sql, statement);
    }
    return statement;
  }

  /** Runs `work` inside one write transaction; any throw rolls every earlier write back. */
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const outcome = work();
      db.exec('COMMIT');
      return outcome;
    } catch (error) {
      rollbackQuietly(db);
      throw error;
    }
  }

  function getSource(id) {
    if (typeof id !== 'string') return null;
    const row = statements.sourceById.get(id);
    return row ? projectSource(row) : null;
  }

  function addSource(options, now) {
    const at = requireTime(now);
    const feedUrl = requireFeedUrl(options?.feedUrl);
    const label = normalizeLabel(options?.title);
    return transaction(() => {
      if (statements.sourceByUrl.get(feedUrl)) throw new ReaderError('SOURCE_EXISTS', 409);
      if (Number(statements.countSources.get().total) >= LIMITS.sources) {
        throw new ReaderError('SOURCE_LIMIT', 409);
      }
      const id = randomUUID();
      statements.insertSource.run(id, feedUrl, label, at);
      return getSource(id);
    });
  }

  function listSources(admin = false) {
    const rows = statements.listSources.all();
    return rows.map((row) => (admin ? adminSource(row) : publicSource(row)));
  }

  function updateSource(id, patch, now) {
    const at = requireTime(now);
    const changes = requireSourcePatch(patch);
    return transaction(() => {
      const source = getSource(id);
      if (!source) throw new ReaderError('NOT_FOUND', 404);
      const assignments = [];
      const parameters = [];
      if ('title' in changes) {
        assignments.push('label = ?');
        parameters.push(normalizeLabel(changes.title));
      }
      if ('enabled' in changes) {
        assignments.push('enabled = ?');
        parameters.push(changes.enabled ? 1 : 0);
        assignments.push('lease_token = NULL', 'lease_until = NULL');
        if (changes.enabled) {
          assignments.push('status = ?', 'next_fetch_at = ?');
          parameters.push('pending', at);
        } else {
          assignments.push('status = ?');
          parameters.push('paused');
        }
      }
      parameters.push(id);
      prepare(`UPDATE sources SET ${assignments.join(', ')} WHERE id = ?`).run(...parameters);
      return getSource(id);
    });
  }

  function deleteSource(id) {
    if (typeof id !== 'string') return false;
    return statements.deleteSource.run(id).changes > 0;
  }

  function dueSources(now) {
    const at = requireTime(now);
    return statements.dueSources.all(at, at).map(projectSource);
  }

  function claimSource(id, now, force = false) {
    const at = requireTime(now);
    return transaction(() => {
      const source = getSource(id);
      if (!source || !source.enabled) return null;
      // A live lease belongs to another worker and stops a claim even when it is forced.
      if (source.leaseUntil !== null && source.leaseUntil > at) return null;
      // force asks for an attempt outside the schedule; it never takes work that is not yet due by
      // itself, so the due time is judged here and not only by dueSources.
      if (!force && source.nextFetchAt > at) return null;
      const token = randomUUID();
      statements.claimSource.run(token, at + LIMITS.leaseMs, at, source.id);
      return getSource(source.id);
    });
  }

  function completeSource(id, token, result = {}, now) {
    const at = requireTime(now);
    return transaction(() => {
      const source = getSource(id);
      if (!source || !source.enabled) return false;
      if (source.leaseToken === null || source.leaseToken !== token) return false;
      const nextFetchAt = at + LIMITS.intervalMs;
      if (result.notModified) {
        statements.completeUnchangedSource.run(at, nextFetchAt, source.id);
        return true;
      }
      const feed = result.feed ?? {};
      if (typeof feed !== 'object' || Array.isArray(feed))
        throw new ReaderError('INVALID_ENTRY', 400);
      const entries = normalizeFeedEntries(source.id, feed.entries);
      const stored = Number(statements.countEntries.get().total);
      let additions = 0;
      for (const entry of entries) {
        if (!statements.entryExists.get(source.id, entry.externalId)) additions += 1;
      }
      // The budget covers the store, not one feed: an oversized package rolls the whole success
      // back, so neither the entries nor the validators nor the success time move.
      if (stored + additions > LIMITS.entries) throw new ReaderError('CAPACITY', 409);
      for (const entry of entries) {
        statements.upsertEntry.run(
          entry.id,
          source.id,
          entry.externalId,
          entry.title,
          entry.url,
          entry.author,
          entry.publishedAt,
          at,
          at,
          entry.contentKind,
          entry.summaryHtml,
          entry.contentHtml,
          entry.truncated ? 1 : 0,
        );
      }
      statements.completeSource.run(
        optionalString(feed.title),
        optionalString(feed.siteUrl),
        optionalString(result.etag),
        optionalString(result.lastModified),
        at,
        nextFetchAt,
        source.id,
      );
      return true;
    });
  }

  function failSource(id, token, failure = {}, now) {
    const at = requireTime(now);
    const code = ERROR_CODE.test(failure.code) ? failure.code : 'FETCH_FAILED';
    const retryAfterMs = clampRetryAfter(failure.retryAfterMs);
    return transaction(() => {
      const source = getSource(id);
      if (!source || !source.enabled) return false;
      if (source.leaseToken === null || source.leaseToken !== token) return false;
      const attempt = source.failureCount + 1;
      const backoff = RETRY_MS[Math.min(attempt - 1, RETRY_MS.length - 1)];
      statements.failSource.run(at + Math.max(backoff, retryAfterMs), code, source.id);
      return true;
    });
  }

  function releaseSource(id, token) {
    return transaction(() => {
      const source = getSource(id);
      if (!source || !source.enabled) return false;
      if (source.leaseToken === null || source.leaseToken !== token) return false;
      // The due time stays as it is, so an interrupted fetch is picked up again on the next start.
      statements.releaseSource.run(
        source.lastSuccessAt === null ? 'pending' : 'ok',
        source.id,
        token,
      );
      return true;
    });
  }

  function clearEntries(sourceId, now) {
    const at = requireTime(now);
    return transaction(() => {
      const source = getSource(sourceId);
      if (!source) throw new ReaderError('NOT_FOUND', 404);
      statements.deleteSourceEntries.run(source.id);
      statements.resetSourceCache.run(at, source.enabled ? 'pending' : 'paused', source.id);
      return true;
    });
  }

  function listEntries(options = {}) {
    const settings = options ?? {};
    const size = normalizeLimit(settings.limit);
    const clauses = [];
    const parameters = [];
    if (typeof settings.sourceId === 'string' && settings.sourceId.length > 0) {
      clauses.push('e.source_id = ?');
      parameters.push(settings.sourceId);
    }
    if (typeof settings.q === 'string' && settings.q.length > 0) {
      if (settings.q.length > MAX_QUERY) throw new ReaderError('INVALID_QUERY', 400);
      const needle = `%${escapeLike(settings.q)}%`;
      clauses.push(`(e.title LIKE ? ESCAPE '\\' OR e.summary_html LIKE ? ESCAPE '\\')`);
      parameters.push(needle, needle);
    }
    const after = decodeCursor(settings.cursor);
    if (after) {
      clauses.push(`(${SORT_AT} < ? OR (${SORT_AT} = ? AND e.id < ?))`);
      parameters.push(after.at, after.at, after.id);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT ${ENTRY_COLUMNS} ${ENTRY_JOIN} ${where}
      ORDER BY ${SORT_AT} DESC, e.id DESC LIMIT ?`;
    const rows = prepare(sql).all(...parameters, size + 1);
    const page = rows.slice(0, size);
    const last = page.at(-1);
    const nextCursor = rows.length > size && last ? encodeCursor(last.sort_at, last.id) : null;
    return { entries: page.map(projectEntry), nextCursor };
  }

  function getEntry(id) {
    if (typeof id !== 'string') return null;
    const row = statements.entryDetail.get(id);
    return row ? { ...projectEntry(row), contentHtml: row.content_html } : null;
  }

  function getAdmin() {
    const row = statements.admin.get();
    return row ? { passwordHash: row.password_hash, version: row.version } : null;
  }

  /** The hash is computed by the caller; setting it revokes every session of the old password. */
  function setAdminPassword(passwordHash) {
    if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
      throw new TypeError('setAdminPassword needs a password hash');
    }
    return transaction(() => {
      const current = statements.admin.get();
      const version = current ? current.version + 1 : 1;
      if (current) statements.updateAdmin.run(passwordHash, version);
      else statements.insertAdmin.run(passwordHash, version);
      statements.deleteAllSessions.run();
      return version;
    });
  }

  function createSession(options, now) {
    const at = requireTime(now);
    const tokenHash = options?.tokenHash;
    const expiresAt = requireTime(options?.expiresAt);
    if (typeof tokenHash !== 'string' || tokenHash.length === 0) {
      throw new TypeError('createSession needs a token hash');
    }
    return transaction(() => {
      const admin = statements.admin.get();
      if (!admin) throw new ReaderError('ADMIN_UNCONFIGURED', 503);
      statements.deleteExpiredSessions.run(at);
      const open = Number(statements.countSessions.get().total);
      if (open >= LIMITS.sessions) statements.deleteOldestSessions.run(open - LIMITS.sessions + 1);
      statements.insertSession.run(tokenHash, admin.version, at, expiresAt);
      return { tokenHash, adminVersion: admin.version, createdAt: at, expiresAt };
    });
  }

  /** Reads only: an expired or stale session is reported without touching the row. */
  function getSession(tokenHash, now) {
    if (typeof tokenHash !== 'string') return null;
    const at = requireTime(now);
    const row = statements.sessionByToken.get(tokenHash);
    if (!row || row.expires_at <= at) return null;
    const admin = statements.admin.get();
    if (!admin || admin.version !== row.admin_version) return null;
    return {
      tokenHash: row.token_hash,
      adminVersion: row.admin_version,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  function deleteSession(tokenHash) {
    if (typeof tokenHash !== 'string') return false;
    return statements.deleteSession.run(tokenHash).changes > 0;
  }

  function cleanupSessions(now) {
    return statements.deleteExpiredSessions.run(requireTime(now)).changes;
  }

  /** Writes a standalone copy of the store.  An existing or linked target is never overwritten. */
  async function backupTo(destination) {
    if (typeof destination !== 'string' || destination.length === 0) {
      throw new TypeError('backupTo needs a destination path');
    }
    if (['', '-wal', '-shm', '-journal'].some((suffix) => pathExists(`${destination}${suffix}`)))
      throw new ReaderError('BACKUP_EXISTS', 409);
    let descriptor;
    try {
      descriptor = openSync(destination, 'wx', 0o600);
    } catch (error) {
      if (error?.code === 'EEXIST') throw new ReaderError('BACKUP_EXISTS', 409);
      throw error;
    }
    closeSync(descriptor);
    try {
      await backup(db, destination);
    } catch (error) {
      discardBackup(destination);
      throw error;
    }
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    db.close();
  }

  return {
    addSource,
    getSource,
    listSources,
    updateSource,
    deleteSource,
    dueSources,
    claimSource,
    completeSource,
    failSource,
    releaseSource,
    clearEntries,
    listEntries,
    getEntry,
    getAdmin,
    setAdminPassword,
    createSession,
    getSession,
    deleteSession,
    cleanupSessions,
    backupTo,
    close,
  };
}

/** Creates the parent directory and the database file itself, both private to their owner. */
function prepareDatabaseFile(filename) {
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  if (!pathExists(filename)) {
    // An exclusive create both claims the name and fixes the mode; the umask cannot loosen it.
    closeSync(openSync(filename, 'wx', 0o600));
  } else if (!lstatSync(filename).isFile() || lstatSync(filename).isSymbolicLink()) {
    throw unknownStore();
  }
}

/** Schema creation is the only write an empty database receives; anything else is left alone. */
function initializeSchema(db) {
  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  if (version === 0) {
    const tables = Number(
      db
        .prepare(
          "SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .get()?.total ?? 0,
    );
    if (tables > 0) throw unknownStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(SCHEMA_SQL);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      db.exec('COMMIT');
    } catch (error) {
      rollbackQuietly(db);
      throw error;
    }
    return;
  }
  if (version !== SCHEMA_VERSION) throw unknownStore();
  const markers = TABLES.map(() => '?').join(', ');
  const present = Number(
    db
      .prepare(
        `SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name IN (${markers})`,
      )
      .get(...TABLES)?.total ?? 0,
  );
  if (present !== TABLES.length) throw unknownStore();
}

function unknownStore() {
  return new ReaderError('STORE_INVALID', 500);
}

function pathExists(target) {
  try {
    lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

function closeQuietly(db) {
  try {
    db?.close();
  } catch {
    // Nothing useful is left to do when the connection that failed to open cannot be closed.
  }
}

function rollbackQuietly(db) {
  try {
    db.exec('ROLLBACK');
  } catch {
    // The transaction is already gone; the error that caused the rollback is what matters.
  }
}

/** Removes only the files this store created for a backup that then failed. */
function discardBackup(destination) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try {
      unlinkSync(`${destination}${suffix}`);
    } catch {
      // A file that is not there was either never created or already removed.
    }
  }
}

function requireTime(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('a millisecond timestamp is required');
  }
  return Math.trunc(value);
}

function requireFeedUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FEED_URL) {
    throw new ReaderError('INVALID_SOURCE', 400);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ReaderError('INVALID_SOURCE', 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ReaderError('INVALID_SOURCE', 400);
  }
  if (parsed.username || parsed.password) throw new ReaderError('INVALID_SOURCE', 400);
  return value;
}

/** The administrator label for a feed: a trimmed, non-empty and short string, else absent. */
function normalizeLabel(value) {
  if (typeof value !== 'string') return null;
  const label = value.trim();
  if (label.length === 0 || value.length > MAX_LABEL) return null;
  return label;
}

function requireSourcePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new ReaderError('INVALID_SOURCE', 400);
  }
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !SOURCE_PATCH_KEYS.has(key))) {
    throw new ReaderError('INVALID_SOURCE', 400);
  }
  if ('enabled' in patch && typeof patch.enabled !== 'boolean') {
    throw new ReaderError('INVALID_SOURCE', 400);
  }
  return patch;
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function feedHostname(feedUrl) {
  try {
    return new URL(feedUrl).hostname;
  } catch {
    return feedUrl;
  }
}

/** The reader shows a user label first, then the feed's own title, then the host it came from. */
function sourceTitle(row) {
  return row.label || row.feed_title || feedHostname(row.feed_url);
}

function projectSource(row) {
  return {
    id: row.id,
    title: sourceTitle(row),
    siteUrl: row.site_url ?? null,
    enabled: row.enabled === 1,
    status: row.status,
    lastAttemptAt: row.last_attempt_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    nextFetchAt: row.next_fetch_at,
    errorCode: row.error_code ?? null,
    entryCount: Number(row.entry_count ?? 0),
    feedUrl: row.feed_url,
    failureCount: row.failure_count,
    etag: row.etag ?? null,
    lastModified: row.last_modified ?? null,
    leaseToken: row.lease_token ?? null,
    leaseUntil: row.lease_until ?? null,
  };
}

/** The public projection: user labels and status only, never a feed url or a lease. */
function publicSource(row) {
  const {
    id,
    title,
    siteUrl,
    enabled,
    status,
    lastAttemptAt,
    lastSuccessAt,
    nextFetchAt,
    errorCode,
    entryCount,
  } = projectSource(row);
  return {
    id,
    title,
    siteUrl,
    enabled,
    status,
    lastAttemptAt,
    lastSuccessAt,
    nextFetchAt,
    errorCode,
    entryCount,
  };
}

function adminSource(row) {
  return { ...publicSource(row), feedUrl: row.feed_url, failureCount: row.failure_count };
}

function projectEntry(row) {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceTitle: sourceTitle(row),
    title: row.title,
    url: row.url ?? null,
    author: row.author ?? null,
    publishedAt: row.published_at ?? null,
    collectedAt: row.collected_at,
    updatedAt: row.updated_at,
    contentKind: row.content_kind,
    summaryHtml: row.summary_html,
    truncated: row.truncated === 1,
  };
}

/** Entry identity inside one source is the feed's own id, so a shared link cannot merge two rows. */
function entryId(sourceId, externalId) {
  return createHash('sha256').update(sourceId).update('\0').update(externalId).digest('hex');
}

/** Validates one harvested entry and drops a duplicate id inside the same package, last one wins. */
function normalizeFeedEntries(sourceId, entries) {
  if (entries === undefined || entries === null) return [];
  if (!Array.isArray(entries)) throw new ReaderError('INVALID_ENTRY', 400);
  const unique = new Map();
  for (const entry of entries) {
    const {
      externalId,
      title,
      url,
      author,
      publishedAt,
      contentKind,
      summaryHtml,
      contentHtml,
      truncated,
    } = entry ?? {};
    if (typeof externalId !== 'string' || externalId.length === 0) {
      throw new ReaderError('INVALID_ENTRY', 400);
    }
    if (typeof title !== 'string' || typeof summaryHtml !== 'string') {
      throw new ReaderError('INVALID_ENTRY', 400);
    }
    if (typeof contentHtml !== 'string' || !CONTENT_KINDS.has(contentKind)) {
      throw new ReaderError('INVALID_ENTRY', 400);
    }
    if (publishedAt !== undefined && publishedAt !== null && !Number.isFinite(publishedAt)) {
      throw new ReaderError('INVALID_ENTRY', 400);
    }
    unique.set(externalId, {
      id: entryId(sourceId, externalId),
      externalId,
      title,
      url: optionalString(url),
      author: optionalString(author),
      publishedAt:
        publishedAt === undefined || publishedAt === null ? null : Math.trunc(publishedAt),
      contentKind,
      summaryHtml,
      contentHtml,
      truncated: truncated === true,
    });
  }
  return [...unique.values()];
}

function clampRetryAfter(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), LIMITS.intervalMs);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function normalizeLimit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return LIMITS.pageSize;
  return Math.min(LIMITS.pageSize, Math.max(1, Math.trunc(value)));
}

function encodeCursor(sortAt, id) {
  return Buffer.from(JSON.stringify([sortAt, id]), 'utf8').toString('base64url');
}

/** A cursor is exactly the sort key of the last row of the previous page, nothing more. */
function decodeCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
  } catch {
    throw new ReaderError('INVALID_CURSOR', 400);
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw new ReaderError('INVALID_CURSOR', 400);
  const [sortAt, id] = parsed;
  if (!Number.isSafeInteger(sortAt) || typeof id !== 'string' || !ENTRY_ID.test(id)) {
    throw new ReaderError('INVALID_CURSOR', 400);
  }
  return { at: sortAt, id };
}
