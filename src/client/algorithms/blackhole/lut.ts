/**
 * Strict readers for the precomputed ray-tracing tables of the black hole scene.
 *
 * The four `.dat` files are little-endian float32 dumps written by the upstream image preprocessor;
 * `deflection.dat` and `inverse_radius.dat` begin with an 8-byte width/height header, the two colour
 * tables are headerless. Header values and the exact byte length are checked before any data reaches
 * the GPU, so a truncated or substituted file fails the scene (which keeps the still image) instead
 * of feeding the ray tracer wrong numbers. URL, upstream revision, length and SHA-256 of every file
 * are recorded in `src/client/vendor/blackhole/manifest.json`.
 */

export type LutSpec = {
  /** File name below `ASSET_ROOT`. */
  file: string;
  width: number;
  height: number;
  /** Slices of a 3D table; 1 for the 2D tables. */
  depth: number;
  /** Floats per texel: 2 for the RG tables, 3 for the RGB tables. */
  channels: number;
  /** Bytes in front of the payload: the two float32 dimensions, or 0 for a raw dump. */
  headerBytes: number;
};

/** Same-origin location of the vendored tables: nothing is fetched from a CDN at runtime. */
export const ASSET_ROOT = '/vendor/blackhole/';

/** Table layouts as deployed. Values come from the upstream preprocessor, not from guesswork. */
export const LUTS = {
  deflection: {
    file: 'deflection.dat',
    width: 512,
    height: 512,
    depth: 1,
    channels: 2,
    headerBytes: 8,
  },
  inverseRadius: {
    file: 'inverse_radius.dat',
    width: 64,
    height: 32,
    depth: 1,
    channels: 2,
    headerBytes: 8,
  },
  doppler: {
    file: 'doppler.dat',
    width: 64,
    height: 32,
    depth: 64,
    channels: 3,
    headerBytes: 0,
  },
  blackBody: {
    file: 'black_body.dat',
    width: 128,
    height: 1,
    depth: 1,
    channels: 3,
    headerBytes: 0,
  },
} as const satisfies Record<string, LutSpec>;

/** The disc noise is a repeat-sampled 8-bit PNG, uploaded as its red channel. */
export const NOISE_TEXTURE = { file: 'noise_texture.png', width: 128, height: 128 } as const;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Exact byte length of a table, header included. */
export function lutByteLength(spec: LutSpec): number {
  return spec.headerBytes + spec.width * spec.height * spec.depth * spec.channels * 4;
}

/**
 * Reads one table. The byte length must match exactly and, when the file carries a header, that
 * header must name the dimensions the spec expects. The payload is returned as a private copy, so
 * the caller cannot be surprised by a later detach of the network buffer.
 */
export function parseLut(buffer: ArrayBuffer, spec: LutSpec): Float32Array {
  const expected = lutByteLength(spec);
  if (buffer.byteLength !== expected)
    throw new Error(`${spec.file}: expected ${expected} bytes, read ${buffer.byteLength}`);
  let offset = 0;
  if (spec.headerBytes > 0) {
    if (spec.headerBytes !== 8)
      throw new Error(`${spec.file}: ${spec.headerBytes}-byte headers are not supported`);
    const header = new DataView(buffer);
    const width = header.getFloat32(0, true);
    const height = header.getFloat32(4, true);
    if (!Number.isInteger(width) || !Number.isInteger(height))
      throw new Error(`${spec.file}: header does not hold a texel size`);
    if (width !== spec.width || height !== spec.height)
      throw new Error(
        `${spec.file}: header says ${width}x${height}, expected ${spec.width}x${spec.height}`,
      );
    offset = spec.headerBytes;
  }
  return new Float32Array(new Float32Array(buffer, offset, (expected - offset) / 4));
}

/**
 * Validates the noise PNG before the browser decodes it: signature, first chunk and the 8-bit
 * RGBA/128x128 layout the repeat-sampled shader noise was sized for.
 */
export function parsePngHeader(
  bytes: Uint8Array,
  spec: { width: number; height: number },
): { width: number; height: number; bitDepth: number; colorType: number } {
  if (bytes.byteLength < 33) throw new Error(`${NOISE_TEXTURE.file}: truncated PNG`);
  for (const [index, value] of PNG_SIGNATURE.entries()) {
    if (bytes[index] !== value) throw new Error(`${NOISE_TEXTURE.file}: not a PNG`);
  }
  const tag = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4));
  if (tag(12) !== 'IHDR') throw new Error(`${NOISE_TEXTURE.file}: first chunk is not IHDR`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  if (width !== spec.width || height !== spec.height)
    throw new Error(
      `${NOISE_TEXTURE.file}: is ${width}x${height}, expected ${spec.width}x${spec.height}`,
    );
  if (bitDepth !== 8 || colorType !== 6)
    throw new Error(`${NOISE_TEXTURE.file}: expected an 8-bit RGBA image`);
  if (bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0)
    throw new Error(`${NOISE_TEXTURE.file}: unexpected compression, filter or interlace method`);
  return { width, height, bitDepth, colorType };
}

/** Fetches one vendored file from the same origin. The signal aborts a load the user has left. */
export async function fetchAsset(file: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(`${ASSET_ROOT}${file}`, { signal });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error(`${file}: empty response`);
  return buffer;
}
