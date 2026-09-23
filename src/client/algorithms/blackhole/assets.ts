/**
 * Share the five raw assets between prefetch and scenes, never decoded images or GPU resources.
 * Manifest digests identify the build's asset version; runtime validation checks lengths and
 * headers, not content hashes. Pending requests stop only when their last consumer leaves.
 */

import manifest from '../../vendor/blackhole/manifest.json';
import { fetchAsset, LUTS, NOISE_TEXTURE, parseLut, parsePngHeader, type LutSpec } from './lut';

/** The fields of `BlackHoleAssets` that hold bytes, in fetch order. */
type AssetKey = 'deflection' | 'inverseRadius' | 'doppler' | 'blackBody' | 'noise';

/**
 * The five runtime assets as fetched and validated. Only `ArrayBuffer`s are shared: every consumer
 * makes its own typed views, its own decoded bitmap and its own GPU objects from them.
 */
export type BlackHoleAssets = Readonly<{
  version: string;
  deflection: ArrayBuffer;
  inverseRadius: ArrayBuffer;
  doppler: ArrayBuffer;
  blackBody: ArrayBuffer;
  noise: ArrayBuffer;
}>;

export type BlackHoleAssetCache = {
  load(signal: AbortSignal): Promise<BlackHoleAssets>;
  invalidate(value: BlackHoleAssets): void;
};

/** The wait the consumers of one group share. */
type Deferred = {
  promise: Promise<BlackHoleAssets>;
  resolve(value: BlackHoleAssets): void;
  reject(error: unknown): void;
};

/** One fetch group: its own controller, its consumers and the value it handed out. */
type Entry = {
  controller: AbortController;
  status: 'pending' | 'ready';
  consumers: Set<symbol>;
  result: Deferred;
  value?: BlackHoleAssets;
};

type ManifestEntry = { kind: string; path: string; bytes: number; sha256: string };

/** The file name of a manifest path: what a fetch URL ends with. */
function assetName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The runtime assets of the vendored manifest, ordered by path so the version string is stable. */
const RUNTIME_ASSETS: ManifestEntry[] = manifest.entries
  .filter((entry) => entry.kind === 'runtime-asset')
  .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

/** What the deployed files are, from the manifest: file names and digests, never the bytes sent. */
const VERSION = RUNTIME_ASSETS.map((entry) => `${assetName(entry.path)}:${entry.sha256}`).join(' ');

/** The byte count the manifest records per file. */
const MANIFEST_BYTES = new Map<string, number>(
  RUNTIME_ASSETS.map((entry): [string, number] => [assetName(entry.path), entry.bytes]),
);

/**
 * The five assets, in fetch order. `key` is the field of `BlackHoleAssets` the buffer lands in and
 * `lut` is the layout its length and header are checked against, absent for the noise PNG.
 */
const ASSET_FILES: readonly { key: AssetKey; file: string; lut?: LutSpec }[] = [
  { key: 'deflection', file: LUTS.deflection.file, lut: LUTS.deflection },
  { key: 'inverseRadius', file: LUTS.inverseRadius.file, lut: LUTS.inverseRadius },
  { key: 'doppler', file: LUTS.doppler.file, lut: LUTS.doppler },
  { key: 'blackBody', file: LUTS.blackBody.file, lut: LUTS.blackBody },
  { key: 'noise', file: NOISE_TEXTURE.file },
];

/**
 * Checks one download before it can be shared: the manifest's byte count, then the layout. The
 * parsed copy `parseLut` builds is deliberately thrown away — only the raw bytes are cached.
 */
function validate(file: string, lut: LutSpec | undefined, buffer: ArrayBuffer): void {
  const expected = MANIFEST_BYTES.get(file);
  if (expected === undefined)
    throw new Error(`${file}: the manifest records no runtime asset of that name`);
  if (buffer.byteLength !== expected)
    throw new Error(`${file}: the manifest records ${expected} bytes, read ${buffer.byteLength}`);
  if (lut) parseLut(buffer, lut);
  else parsePngHeader(new Uint8Array(buffer), NOISE_TEXTURE);
}

function requireBuffer(buffers: ReadonlyMap<AssetKey, ArrayBuffer>, key: AssetKey): ArrayBuffer {
  const buffer = buffers.get(key);
  if (!buffer) throw new Error(`Black hole asset ${key} was not fetched`);
  return buffer;
}

function deferred(): Deferred {
  let resolve!: (value: BlackHoleAssets) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<BlackHoleAssets>((onValue, onError) => {
    resolve = onValue;
    reject = onError;
  });
  return { promise, resolve, reject };
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/**
 * Builds a cache over one fetcher. It exists for this module's own shared group and for tests that
 * drive the five requests themselves; it is not a general purpose cache.
 */
export function createBlackHoleAssetCache(
  fetchFile: typeof fetchAsset = fetchAsset,
): BlackHoleAssetCache {
  let current: Entry | undefined;

  /**
   * Starts the five requests of a pending group and settles its wait either way. The group is
   * dropped before its controller is aborted, and only while it is still the current one: a request
   * that arrives late must neither become the cache nor clear its successor.
   */
  async function run(entry: Entry): Promise<void> {
    try {
      const buffers = new Map(
        await Promise.all(
          ASSET_FILES.map(async ({ key, file }): Promise<readonly [AssetKey, ArrayBuffer]> => [
            key,
            await fetchFile(file, entry.controller.signal),
          ]),
        ),
      );
      entry.result.resolve(commit(entry, buffers));
    } catch (error) {
      if (current === entry) current = undefined;
      entry.controller.abort();
      entry.result.reject(error);
    }
  }

  /**
   * Validates the five buffers and installs them as the group's value. A group that stopped being
   * current — its consumers left, or a later group replaced it — installs nothing.
   */
  function commit(entry: Entry, buffers: ReadonlyMap<AssetKey, ArrayBuffer>): BlackHoleAssets {
    if (current !== entry || entry.controller.signal.aborted) throw abortError();
    for (const { key, file, lut } of ASSET_FILES) validate(file, lut, requireBuffer(buffers, key));
    const value: BlackHoleAssets = Object.freeze({
      version: VERSION,
      deflection: requireBuffer(buffers, 'deflection'),
      inverseRadius: requireBuffer(buffers, 'inverseRadius'),
      doppler: requireBuffer(buffers, 'doppler'),
      blackBody: requireBuffer(buffers, 'blackBody'),
      noise: requireBuffer(buffers, 'noise'),
    });
    entry.value = value;
    entry.status = 'ready';
    return value;
  }

  /** Drops a pending group and aborts its requests. The drop comes first, on purpose. */
  function release(entry: Entry): void {
    if (current === entry) current = undefined;
    entry.controller.abort();
  }

  /**
   * Registers one consumer. Its own wait settles with the group's value, with the group's failure,
   * or with its own abort — which only ever rejects that one wait.
   */
  function consume(entry: Entry, signal: AbortSignal): Promise<BlackHoleAssets> {
    const token = Symbol('black hole asset consumer');
    entry.consumers.add(token);
    return new Promise<BlackHoleAssets>((resolve, reject) => {
      const onAbort = () => {
        // A wait that already settled is not aborted a second time.
        if (!entry.consumers.delete(token)) return;
        signal.removeEventListener('abort', onAbort);
        reject(abortError());
        // The last consumer of a pending group takes the requests with it. A ready group has
        // nothing in flight and stays cached for the next load.
        if (entry.status === 'pending' && entry.consumers.size === 0) release(entry);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      entry.result.promise.then(
        (value) => {
          entry.consumers.delete(token);
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          entry.consumers.delete(token);
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  /** Creates the pending group and publishes it as current. Nothing is fetched yet. */
  function open(): Entry {
    const entry: Entry = {
      controller: new AbortController(),
      status: 'pending',
      consumers: new Set(),
      result: deferred(),
    };
    current = entry;
    return entry;
  }

  /**
   * Starts the requests of a group whose first consumer is registered. The wait already carries a
   * rejection handler, so a group that fails early is never an unhandled rejection — not even when
   * its last consumer has left by the time the failure lands.
   */
  function start(entry: Entry): void {
    entry.result.promise.catch(() => {});
    void run(entry);
  }

  function load(signal: AbortSignal): Promise<BlackHoleAssets> {
    // A signal that is already aborted starts nothing: no group and no request.
    if (signal.aborted) return Promise.reject(abortError());
    if (current) return consume(current, signal);
    const entry = open();
    const waiting = consume(entry, signal);
    start(entry);
    return waiting;
  }

  /**
   * Drops the group that handed out this exact value, so the next load fetches again. Identity is
   * what is compared: an older value cannot drop the group that replaced it, and another cache's
   * value drops nothing here.
   */
  function invalidate(value: BlackHoleAssets): void {
    if (current?.value === value) current = undefined;
  }

  return { load, invalidate };
}

/** The scene and prefetch share one group; failed or invalidated groups can be retried. */
const shared = createBlackHoleAssetCache();

/**
 * Join the current download or reuse validated bytes. Cancelling one consumer leaves the others
 * intact; failed validation or the last pending consumer leaving allows a fresh attempt.
 */
export function loadBlackHoleAssets(signal: AbortSignal): Promise<BlackHoleAssets> {
  return shared.load(signal);
}

/**
 * Drops a value this module handed out — used when those exact bytes turn out to be unusable, so
 * the next load fetches them again instead of sharing them.
 */
export function invalidateBlackHoleAssets(value: BlackHoleAssets): void {
  shared.invalidate(value);
}
