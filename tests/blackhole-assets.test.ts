import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as settle } from 'node:timers/promises';
import test from 'node:test';

import {
  createBlackHoleAssetCache,
  invalidateBlackHoleAssets,
  loadBlackHoleAssets,
  type BlackHoleAssets,
} from '../src/client/algorithms/blackhole/assets';
import {
  LUTS,
  NOISE_TEXTURE,
  lutByteLength,
  type LutSpec,
} from '../src/client/algorithms/blackhole/lut';

/**
 * CPU-side checks of the shared black hole asset group: one set of five requests for the scene and
 * the prefetch, and the lifecycle rules that keep a cancelled, stale or failed group out of the
 * cache. Every fixture here is synthetic — the deployed layouts at the manifest's own lengths, never
 * a byte read from a deployed `.dat` file — so these tests never load a real table.
 */

const VENDOR = 'src/client/vendor/blackhole';
const projectPath = (relative: string) => new URL(`../${relative}`, import.meta.url);
const readText = (relative: string) => readFileSync(projectPath(relative), 'utf8');

/** Removes comments, so only code is compared: what a prose sentence says is not a call. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const manifest = JSON.parse(readText(`${VENDOR}/manifest.json`)) as {
  entries: { kind: string; path: string; bytes: number; sha256: string }[];
};
const RUNTIME = manifest.entries.filter((entry) => entry.kind === 'runtime-asset');
const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** The manifest files sorted by path, the order the version string is composed in. */
const byPath = [...RUNTIME].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const VERSION = byPath.map((entry) => `${fileName(entry.path)}:${entry.sha256}`).join(' ');

/** The five files the cache fetches, in fetch order. */
const FILES = [
  LUTS.deflection.file,
  LUTS.inverseRadius.file,
  LUTS.doppler.file,
  LUTS.blackBody.file,
  NOISE_TEXTURE.file,
];

/** What the manifest records for a file, which is also the length a download must have. */
function manifestBytes(file: string): number {
  const entry = RUNTIME.find((candidate) => candidate.path.endsWith(`/${file}`));
  assert.ok(entry, `${file}: not a runtime asset of the manifest`);
  return entry.bytes;
}

/** A table of the deployed layout: the manifest's length, its header, and a value of our own. */
function syntheticTable(spec: LutSpec, fill: number): ArrayBuffer {
  const buffer = new ArrayBuffer(manifestBytes(spec.file));
  if (spec.headerBytes > 0) {
    const header = new DataView(buffer);
    header.setFloat32(0, spec.width, true);
    header.setFloat32(4, spec.height, true);
  }
  new Float32Array(buffer, spec.headerBytes).fill(fill);
  return buffer;
}

/** A PNG the reader accepts: signature, 128x128 8-bit RGBA IHDR, padded to the deployed length. */
function syntheticNoise(): ArrayBuffer {
  const buffer = new ArrayBuffer(manifestBytes(NOISE_TEXTURE.file));
  const bytes = new Uint8Array(buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(buffer);
  view.setUint32(16, NOISE_TEXTURE.width);
  view.setUint32(20, NOISE_TEXTURE.height);
  bytes[24] = 8; // Bit depth
  bytes[25] = 6; // Colour type: RGBA
  return buffer;
}

/** What the fetcher hands back. `fill` tells one round's bytes from the next ones' without digests. */
function syntheticBytes(fill = 0.5): Map<string, ArrayBuffer> {
  const files = new Map<string, ArrayBuffer>();
  for (const spec of Object.values(LUTS)) files.set(spec.file, syntheticTable(spec, fill));
  files.set(NOISE_TEXTURE.file, syntheticNoise());
  return files;
}

/** The value a table fixture carries, so a test can tell which round's bytes were installed. */
function tableFill(buffer: ArrayBuffer, spec: LutSpec): number {
  return new Float32Array(buffer, spec.headerBytes, 1)[0]!;
}

type Request = {
  file: string;
  signal: AbortSignal;
  resolve(buffer: ArrayBuffer): void;
  reject(error: unknown): void;
};

/** A fetcher the test drives: every call is recorded and settles only when the test says so. */
function recordingFetcher(options: { ignoreAbort?: boolean } = {}) {
  const requests: Request[] = [];
  const fetchFile = (file: string, signal: AbortSignal): Promise<ArrayBuffer> =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      requests.push({ file, signal, resolve, reject });
      // A real request rejects when its signal aborts; `ignoreAbort` models one that does not.
      if (!options.ignoreAbort)
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
    });
  return {
    requests,
    fetchFile,
    files: () => requests.map((request) => request.file),
    aborted: () => requests.filter((request) => request.signal.aborted).length,
  };
}

type Fetcher = ReturnType<typeof recordingFetcher>;

/** The five requests of one group, in fetch order. */
function round(fetcher: Fetcher, index: number): Request[] {
  return fetcher.requests.slice(index * 5, index * 5 + 5);
}

/** Hands the recorded requests their bytes. */
function deliver(requests: readonly Request[], bytes: ReadonlyMap<string, ArrayBuffer>): void {
  for (const request of requests) {
    const buffer = bytes.get(request.file);
    assert.ok(buffer, `${request.file}: no synthetic bytes`);
    request.resolve(buffer);
  }
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

test('the fixed five files are the manifest runtime assets at their recorded lengths', () => {
  assert.equal(RUNTIME.length, 5);
  assert.deepEqual([...FILES].sort(), RUNTIME.map((entry) => fileName(entry.path)).sort());
  // The lengths the cache checks a download against are the layouts the reader expects.
  for (const spec of Object.values(LUTS))
    assert.equal(manifestBytes(spec.file), lutByteLength(spec), spec.file);
});

test('five requests serve two consumers that arrive together', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const first = cache.load(new AbortController().signal);
  const second = cache.load(new AbortController().signal);
  // One request per file, started together, in the order of the fixed file list.
  assert.deepEqual(fetcher.files(), FILES);

  deliver(round(fetcher, 0), syntheticBytes());
  const assets = await first;
  assert.equal(await second, assets);
  assert.equal(fetcher.requests.length, 5);
  // The version names every file and the digest the manifest records for it.
  assert.equal(assets.version, VERSION);
  for (const entry of RUNTIME) assert.ok(assets.version.includes(entry.sha256), entry.path);
  // Bytes only: no typed view, no decoded image and no GL object is handed out.
  for (const [key, value] of Object.entries(assets)) {
    if (key !== 'version') assert.ok(value instanceof ArrayBuffer, key);
  }
  assert.equal(assets.deflection.byteLength, manifestBytes(LUTS.deflection.file));
  assert.equal(assets.noise.byteLength, manifestBytes(NOISE_TEXTURE.file));
});

test('the version comes from the manifest, not from a re-hash of the bytes that arrived', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const first = cache.load(new AbortController().signal);
  deliver(round(fetcher, 0), syntheticBytes(0.25));
  const assets = await first;

  cache.invalidate(assets);
  const second = cache.load(new AbortController().signal);
  deliver(round(fetcher, 1), syntheticBytes(0.75));
  const replacement = await second;
  // Different bytes, same version: the version describes the manifest, and nothing here hashes.
  assert.notEqual(tableFill(replacement.deflection, LUTS.deflection), 0.25);
  assert.equal(replacement.version, assets.version);
});

test('cancelling one consumer leaves the other waiting on the same requests', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const leaving = new AbortController();
  const abandoned = cache.load(leaving.signal);
  const waiting = cache.load(new AbortController().signal);
  leaving.abort();
  await assert.rejects(abandoned, /Aborted/);
  // The shared requests are untouched while another consumer is still waiting on them.
  assert.equal(fetcher.aborted(), 0);

  deliver(round(fetcher, 0), syntheticBytes());
  assert.equal((await waiting).version, VERSION);
  assert.equal(fetcher.requests.length, 5);
});

test('the last consumer of a pending group aborts all five requests', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const controller = new AbortController();
  const waiting = cache.load(controller.signal);
  controller.abort();
  await assert.rejects(waiting, /Aborted/);
  assert.equal(fetcher.aborted(), 5);

  // The group is gone, so the next load starts five requests of its own.
  const again = cache.load(new AbortController().signal);
  assert.equal(fetcher.requests.length, 10);
  deliver(round(fetcher, 1), syntheticBytes());
  assert.equal((await again).version, VERSION);
});

test('an already aborted signal starts no group and sends no request', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(cache.load(controller.signal), /Aborted/);
  assert.deepEqual(fetcher.requests, []);

  // Nothing was prepared, so the next load does the whole job as if that had not happened.
  const waiting = cache.load(new AbortController().signal);
  assert.deepEqual(fetcher.files(), FILES);
  deliver(round(fetcher, 0), syntheticBytes());
  assert.equal((await waiting).version, VERSION);
});

test('a ready value is reused without another request', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const first = cache.load(new AbortController().signal);
  deliver(round(fetcher, 0), syntheticBytes());
  const assets = await first;

  assert.equal(await cache.load(new AbortController().signal), assets);
  assert.equal(await cache.load(new AbortController().signal), assets);
  // A consumer that leaves a ready value takes nothing away from the cache either.
  const leaving = new AbortController();
  const abandoned = cache.load(leaving.signal);
  leaving.abort();
  await assert.rejects(abandoned, /Aborted/);
  assert.equal(await cache.load(new AbortController().signal), assets);
  assert.equal(fetcher.requests.length, 5);
});

test('a failed group is not cached and the next load starts over', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const waiting = cache.load(new AbortController().signal);
  round(fetcher, 0)[0]!.reject(new Error('HTTP 500'));
  await assert.rejects(waiting, /HTTP 500/);
  // The requests that were still in flight were aborted, and nothing was kept.
  assert.equal(fetcher.aborted(), 5);

  const again = cache.load(new AbortController().signal);
  assert.equal(fetcher.requests.length, 10);
  deliver(round(fetcher, 1), syntheticBytes());
  assert.equal((await again).version, VERSION);
});

test('bytes that fail the manifest and layout checks are not cached', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);

  /** Serves one file with bytes of our own, one group per round, and expects the load to fail. */
  async function rejectRound(
    index: number,
    file: string,
    buffer: ArrayBuffer,
    expected: RegExp,
  ): Promise<void> {
    const waiting = cache.load(new AbortController().signal);
    // Every round opens its own group: nothing an earlier round delivered was kept.
    assert.equal(fetcher.requests.length, (index + 1) * 5);
    const bytes = syntheticBytes();
    bytes.set(file, buffer);
    deliver(round(fetcher, index), bytes);
    await assert.rejects(waiting, expected);
  }

  const shortTable = new RegExp(
    `manifest records ${manifestBytes(LUTS.deflection.file)} bytes, read 8`,
  );
  await rejectRound(0, LUTS.deflection.file, new ArrayBuffer(8), shortTable);

  const wrongHeader = syntheticTable(LUTS.deflection, 0.5);
  new DataView(wrongHeader).setFloat32(0, 3, true);
  await rejectRound(1, LUTS.deflection.file, wrongHeader, /header says 3x512, expected 512x512/);

  const shortNoise = new RegExp(
    `manifest records ${manifestBytes(NOISE_TEXTURE.file)} bytes, read 33`,
  );
  await rejectRound(2, NOISE_TEXTURE.file, new ArrayBuffer(33), shortNoise);

  const wrongSize = syntheticNoise();
  new DataView(wrongSize).setUint32(16, 64);
  await rejectRound(3, NOISE_TEXTURE.file, wrongSize, /is 64x128, expected 128x128/);

  // The failures cost nothing beyond a retry: the next group is served normally.
  const good = cache.load(new AbortController().signal);
  deliver(round(fetcher, 4), syntheticBytes());
  assert.equal((await good).version, VERSION);
});

test('a request that arrives after its group was cancelled does not become the cache', async () => {
  const fetcher = recordingFetcher({ ignoreAbort: true });
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const abandoned = new AbortController();
  const first = cache.load(abandoned.signal);
  abandoned.abort();
  await assert.rejects(first, /Aborted/);
  const stale = round(fetcher, 0);

  // A later load opens a group of its own while the abandoned requests are still out there.
  const second = cache.load(new AbortController().signal);
  assert.equal(fetcher.requests.length, 10);

  // The abandoned requests answer at last, with bytes of their own.
  deliver(stale, syntheticBytes(0.25));
  await settle();

  // The current group is untouched: another consumer still waits on it, not on those bytes.
  const third = cache.load(new AbortController().signal);
  assert.equal(fetcher.requests.length, 10);
  deliver(round(fetcher, 1), syntheticBytes(0.75));
  const assets = await second;
  assert.equal(await third, assets);
  assert.equal(tableFill(assets.deflection, LUTS.deflection), 0.75);
});

test('an old value cannot drop the group that replaced it', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const first = cache.load(new AbortController().signal);
  deliver(round(fetcher, 0), syntheticBytes(0.25));
  const assets = await first;

  // Dropping the current value makes the next load fetch again.
  cache.invalidate(assets);
  const second = cache.load(new AbortController().signal);
  assert.equal(fetcher.requests.length, 10);
  deliver(round(fetcher, 1), syntheticBytes(0.75));
  const replacement = await second;
  assert.notEqual(replacement, assets);

  // The value that was already replaced cannot take its replacement with it.
  cache.invalidate(assets);
  assert.equal(await cache.load(new AbortController().signal), replacement);
  assert.equal(fetcher.requests.length, 10);

  // The replacement itself is droppable, so a retry after it works.
  cache.invalidate(replacement);
  const third = cache.load(new AbortController().signal);
  assert.equal(fetcher.requests.length, 15);
  deliver(round(fetcher, 2), syntheticBytes());
  assert.equal((await third).version, VERSION);
});

test('a prefetch consumer leaving does not restart the requests an active consumer joined', async () => {
  const fetcher = recordingFetcher();
  const cache = createBlackHoleAssetCache(fetcher.fetchFile);
  const prefetch = new AbortController();
  const active = new AbortController();
  const prefetched = cache.load(prefetch.signal);
  const activated = cache.load(active.signal);
  assert.equal(fetcher.requests.length, 5);

  // The prefetch is given up, but the scene that joined it is still waiting for those bytes.
  prefetch.abort();
  await assert.rejects(prefetched, /Aborted/);
  assert.equal(fetcher.aborted(), 0);

  deliver(round(fetcher, 0), syntheticBytes());
  assert.equal((await activated).version, VERSION);
  assert.equal(fetcher.requests.length, 5);
});

test('the scene shares the cache and drops it only when the bytes themselves fail', () => {
  const scene = readText('src/client/algorithms/blackhole/scene.ts');
  const source = code(scene);
  // One shared load, and no request of the scene's own.
  assert.match(source, /const assets = await loadBlackHoleAssets\(abort\.signal\);/);
  assert.doesNotMatch(source, /\bfetchAsset\(/);

  // The parse and the decode are the only place a value is dropped, and only for a real failure.
  const beforeGpu = source.slice(
    source.indexOf('loadBlackHoleAssets('),
    source.indexOf('createSurface('),
  );
  assert.match(beforeGpu, /parseLut\(assets\.deflection, LUTS\.deflection\)/);
  assert.match(beforeGpu, /decodeNoiseTexture\(noiseBytesView\)/);
  assert.match(
    beforeGpu,
    /if \(!signal\.aborted && !isAbortError\(error\)\) invalidateBlackHoleAssets\(assets\);/,
  );

  // Surface creation, program compilation and the uploads never drop validated network bytes.
  assert.doesNotMatch(source.slice(source.indexOf('createSurface(')), /invalidateBlackHoleAssets/);
  // The decode stays this scene's own, and the bitmap is still closed on every path.
  assert.match(source, /noise = await decodeNoiseTexture\(noiseBytesView\)/);
  assert.match(source, /noise\?\.close\(\)/);

  // The shader of the default geometry is built on first use and only after the build returned, so
  // a failed integral leaves the cache empty for the next scene, and there is one build site.
  assert.match(source, /let defaultFragmentSource: string \| undefined;/);
  assert.match(source, /program\(gl, vertexSource, discFragmentSource\(\)\)/);
  assert.equal(source.match(/= fragmentSource\(/g)?.length, 1);
});

test('the shared group caches bytes and nothing a GPU owns', () => {
  const source = code(readText('src/client/algorithms/blackhole/assets.ts'));
  assert.doesNotMatch(source, /createImageBitmap|ImageBitmap|WebGL|texImage/);
});

test('the module cache sends nothing for a signal that is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  // The real cache over the real fetcher: an aborted signal may not reach the network.
  await assert.rejects(loadBlackHoleAssets(controller.signal), /Aborted/);
  // A value this cache never handed out is not its to drop.
  const foreign: BlackHoleAssets = Object.freeze({
    version: 'somewhere else',
    deflection: new ArrayBuffer(0),
    inverseRadius: new ArrayBuffer(0),
    doppler: new ArrayBuffer(0),
    blackBody: new ArrayBuffer(0),
    noise: new ArrayBuffer(0),
  });
  assert.doesNotThrow(() => invalidateBlackHoleAssets(foreign));
});
