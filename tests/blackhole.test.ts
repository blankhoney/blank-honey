import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { algorithmBudget } from '../src/client/algorithm-hero';
import { algorithmResolution } from '../src/client/algorithms/types';
import {
  blackHoleFraming,
  CAMERA_ELEVATION,
  CAMERA_FOV_Y,
  CAMERA_RADIUS,
  ORBIT_RATE,
  POINTER_PITCH_LIMIT,
  POINTER_YAW_LIMIT,
  pointerOrbit,
  smoothToward,
  staticClockRate,
  staticObserverUniforms,
  VIEW_CENTER_ASPECT,
} from '../src/client/algorithms/blackhole/camera';
import {
  DISC_INNER_RADIUS,
  DISC_LOOK,
  DISC_OUTER_RADIUS,
  DISC_SEED,
  DISC_TIME_SCALE,
  discGeometry,
  discParameterSource,
} from '../src/client/algorithms/blackhole/disc';
import {
  ASSET_ROOT,
  LUTS,
  NOISE_TEXTURE,
  fetchAsset,
  lutByteLength,
  parseLut,
  parsePngHeader,
} from '../src/client/algorithms/blackhole/lut';
import { SCENE_EXPOSURE } from '../src/client/algorithms/blackhole/scene';
import {
  SKY_BAND_DIRECTION,
  STARFIELD_SEED,
  fragmentSource,
  vertexSource,
} from '../src/client/algorithms/blackhole/shader';

/**
 * CPU-side checks of the black hole scene: table formats and their failure modes, the vendored
 * bytes, the seeded disc, the camera reduction, the tone map's numbers and the assembled GLSL. These
 * are not GPU or browser checks: shader compilation and the rendered look belong to the browser
 * verification step.
 */

const VENDOR = 'src/client/vendor/blackhole';
const DEPLOYED = 'public/vendor/blackhole';
const SOURCES = {
  functions: `${VENDOR}/source/functions.glsl`,
  model: `${VENDOR}/source/model.glsl`,
} as const;

const projectPath = (relative: string) => new URL(`../${relative}`, import.meta.url);
const readText = (relative: string) => readFileSync(projectPath(relative), 'utf8');
/** A private copy, so `buffer` holds the file's own bytes at offset 0 and exactly as long. */
const readBytes = (relative: string) => new Uint8Array(readFileSync(projectPath(relative)));

const geometry = discGeometry();
const shader = fragmentSource(geometry);
/** The scene source, read as text: the tests below check what it uploads, not what it draws. */
const sceneSource = readText('src/client/algorithms/blackhole/scene.ts');

/** Removes comments, so only code is compared: the scene drops upstream's documentation blocks. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Comments and line wrapping removed: what survives is the code itself. */
function compactGlsl(glsl: string): string {
  return stripComments(glsl).replace(/\s+/g, ' ').trim();
}

/**
 * Definitions of one GLSL function, in order of appearance: the return type through the closing
 * brace. Calls and prototypes carry no body and are skipped, so the result holds only definitions.
 */
function glslDefinitions(glsl: string, name: string): string[] {
  const found: string[] = [];
  const call = new RegExp(String.raw`\b${name}\s*\(`, 'g');
  for (const match of glsl.matchAll(call)) {
    const before = glsl.slice(0, match.index);
    const type = /([A-Za-z_]\w*)\s+$/.exec(before);
    if (!type) continue; // A call, not a declaration.
    const start = match.index - type[0].length;
    let depth = 0;
    for (let i = match.index; i < glsl.length; i += 1) {
      const character = glsl[i]!;
      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          found.push(compactGlsl(glsl.slice(start, i + 1)));
          break;
        }
      } else if (character === ';' && depth === 0) {
        break; // A prototype: the definition is further down.
      }
    }
  }
  return found;
}

/** The `#define` lines of a GLSL file, comments removed and whitespace collapsed. */
function glslMacros(glsl: string): string[] {
  return stripComments(glsl)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.startsWith('#define'));
}

test('a table is accepted only with the exact length and a matching header', () => {
  const spec = { file: 'test.dat', width: 2, height: 2, depth: 1, channels: 2, headerBytes: 8 };
  const size = lutByteLength(spec);
  assert.equal(size, 8 + 2 * 2 * 1 * 2 * 4);

  const buffer = new ArrayBuffer(size);
  new DataView(buffer).setFloat32(0, 2, true);
  new DataView(buffer).setFloat32(4, 2, true);
  new Float32Array(buffer, 8).fill(0.25);
  const parsed = parseLut(buffer, spec);
  assert.equal(parsed.length, 8);
  assert.equal(parsed[0], 0.25);
  assert.equal(parsed[7], 0.25);

  // A truncated or oversized file is refused before any of it reaches the GPU.
  assert.throws(() => parseLut(new ArrayBuffer(size - 1), spec), /expected 40 bytes, read 39/);
  assert.throws(() => parseLut(new ArrayBuffer(size + 4), spec), /expected 40 bytes, read 44/);

  const wrongHeader = new ArrayBuffer(size);
  new DataView(wrongHeader).setFloat32(0, 3, true);
  new DataView(wrongHeader).setFloat32(4, 2, true);
  assert.throws(() => parseLut(wrongHeader, spec), /header says 3x2, expected 2x2/);

  const fractionalHeader = new ArrayBuffer(size);
  new DataView(fractionalHeader).setFloat32(0, 1.5, true);
  new DataView(fractionalHeader).setFloat32(4, 2, true);
  assert.throws(() => parseLut(fractionalHeader, spec), /does not hold a texel size/);

  // A headerless table has only its length to check, and the payload is still copied.
  const raw = { file: 'raw.dat', width: 1, height: 1, depth: 1, channels: 3, headerBytes: 0 };
  const rawBuffer = new ArrayBuffer(lutByteLength(raw));
  new Float32Array(rawBuffer).fill(2);
  assert.deepEqual([...parseLut(rawBuffer, raw)], [2, 2, 2]);
  assert.notEqual(parseLut(rawBuffer, raw).buffer, rawBuffer);
});

test('the deployed table layouts are the upstream preprocessor layouts', () => {
  assert.equal(lutByteLength(LUTS.deflection), 2_097_160);
  assert.equal(lutByteLength(LUTS.inverseRadius), 16_392);
  assert.equal(lutByteLength(LUTS.doppler), 1_572_864);
  assert.equal(lutByteLength(LUTS.blackBody), 1_536);
  assert.deepEqual(
    [LUTS.deflection.width, LUTS.deflection.height, LUTS.deflection.channels],
    [512, 512, 2],
  );
  assert.deepEqual(
    [LUTS.inverseRadius.width, LUTS.inverseRadius.height, LUTS.inverseRadius.channels],
    [64, 32, 2],
  );
  assert.deepEqual(
    [LUTS.doppler.width, LUTS.doppler.height, LUTS.doppler.depth, LUTS.doppler.channels],
    [64, 32, 64, 3],
  );
  assert.deepEqual([LUTS.blackBody.width, LUTS.blackBody.height], [128, 1]);
  // Everything is served from the same origin as the page, never from a CDN.
  assert.equal(ASSET_ROOT, '/vendor/blackhole/');
  for (const spec of Object.values(LUTS)) assert.equal(spec.file.includes('/'), false, spec.file);
  assert.equal(`${ASSET_ROOT}${NOISE_TEXTURE.file}`, '/vendor/blackhole/noise_texture.png');
});

test('the deployed files are the bytes recorded in the manifest', () => {
  const manifest = JSON.parse(readText(`${VENDOR}/manifest.json`)) as {
    sourceRef: string;
    dataRef: string;
    entries: {
      kind: string;
      path: string;
      url: string;
      ref: string;
      bytes: number;
      sha256: string;
    }[];
  };
  assert.equal(manifest.sourceRef, 'e72b3f293409893a6fa25528b29572c96fc57f57');
  assert.equal(manifest.dataRef, '0a65035fa6ed8557b7bcb1492894c55f555fdae8');

  const assets = manifest.entries.filter((entry) => entry.kind === 'runtime-asset');
  assert.deepEqual(
    assets.map((entry) => entry.path).sort(),
    [
      `${DEPLOYED}/black_body.dat`,
      `${DEPLOYED}/deflection.dat`,
      `${DEPLOYED}/doppler.dat`,
      `${DEPLOYED}/inverse_radius.dat`,
      `${DEPLOYED}/noise_texture.png`,
    ].sort(),
  );
  // The manifest's byte counts and the reader's layouts are two records of the same files.
  for (const layout of [LUTS.deflection, LUTS.inverseRadius, LUTS.doppler, LUTS.blackBody]) {
    const entry = assets.find((candidate) => candidate.path.endsWith(layout.file));
    assert.equal(entry?.bytes, lutByteLength(layout), layout.file);
  }

  let runtimeBytes = 0;
  for (const entry of manifest.entries) {
    const bytes = readBytes(entry.path);
    assert.equal(bytes.byteLength, entry.bytes, entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
    assert.ok(entry.url.includes(`/${entry.ref}/`), entry.path);
    // Only the two pinned revisions are vendored.
    assert.ok([manifest.sourceRef, manifest.dataRef].includes(entry.ref), entry.path);
    // No sky survey and no demo-only asset: those files are deliberately not part of this set.
    assert.doesNotMatch(entry.url, /gaia|tycho|rocket|star_cube|texture_manager/i, entry.path);
    if (entry.kind === 'runtime-asset') runtimeBytes += entry.bytes;
  }
  // About 3.7 MB of tables, fetched only once the effect is selected.
  assert.equal(runtimeBytes, 3_701_726);
});

test('the deployed tables load through the strict reader', () => {
  for (const spec of Object.values(LUTS)) {
    const bytes = readBytes(`${DEPLOYED}/${spec.file}`);
    assert.equal(bytes.byteLength, lutByteLength(spec), spec.file);
    const floats = parseLut(bytes.buffer, spec);
    assert.equal(floats.length, (bytes.byteLength - spec.headerBytes) / 4);
    let nonFinite = 0;
    for (const value of floats) if (!Number.isFinite(value)) nonFinite += 1;
    assert.equal(nonFinite, 0, `${spec.file}: non-finite values`);
  }
  // The two prefixed tables really do carry their dimensions in the header.
  const deflection = new DataView(readBytes(`${DEPLOYED}/deflection.dat`).buffer);
  assert.equal(deflection.getFloat32(0, true), 512);
  assert.equal(deflection.getFloat32(4, true), 512);
  const inverseRadius = new DataView(readBytes(`${DEPLOYED}/inverse_radius.dat`).buffer);
  assert.equal(inverseRadius.getFloat32(0, true), 64);
  assert.equal(inverseRadius.getFloat32(4, true), 32);
});

test('the noise pattern is checked before it is decoded', () => {
  const bytes = readBytes(`${DEPLOYED}/${NOISE_TEXTURE.file}`);
  assert.deepEqual(parsePngHeader(bytes, NOISE_TEXTURE), {
    width: 128,
    height: 128,
    bitDepth: 8,
    colorType: 6,
  });

  assert.throws(() => parsePngHeader(bytes.subarray(0, 20), NOISE_TEXTURE), /truncated PNG/);
  const notPng = new Uint8Array(bytes);
  notPng[1] = 0;
  assert.throws(() => parsePngHeader(notPng, NOISE_TEXTURE), /not a PNG/);
  const wrongSize = new Uint8Array(bytes);
  new DataView(wrongSize.buffer).setUint32(16, 64);
  assert.throws(() => parsePngHeader(wrongSize, NOISE_TEXTURE), /is 64x128, expected 128x128/);
  const wrongDepth = new Uint8Array(bytes);
  wrongDepth[24] = 16;
  assert.throws(() => parsePngHeader(wrongDepth, NOISE_TEXTURE), /expected an 8-bit RGBA image/);
  const interlaced = new Uint8Array(bytes);
  interlaced[28] = 1;
  assert.throws(() => parsePngHeader(interlaced, NOISE_TEXTURE), /unexpected compression/);
});

test('assets come from the same origin and reject a bad response', async () => {
  const original = globalThis.fetch;
  const calls: { url: string; signal: unknown }[] = [];
  const respond = (response: Response) => {
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), signal: init?.signal });
      return Promise.resolve(response);
    }) as unknown as typeof fetch;
  };
  try {
    const controller = new AbortController();
    respond(new Response(new Uint8Array([1, 2, 3])));
    const bytes = await fetchAsset(LUTS.deflection.file, controller.signal);
    assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3]);
    // Same origin, under the deployed directory, and abortable with the signal it was handed.
    assert.deepEqual(calls, [
      { url: `${ASSET_ROOT}${LUTS.deflection.file}`, signal: controller.signal },
    ]);

    respond(new Response('gone', { status: 404 }));
    await assert.rejects(fetchAsset(NOISE_TEXTURE.file, controller.signal), /HTTP 404/);

    respond(new Response(new Uint8Array(0), { status: 200 }));
    await assert.rejects(fetchAsset(LUTS.doppler.file, controller.signal), /empty response/);
  } finally {
    globalThis.fetch = original;
  }
});

test('the disc rings are seeded, finite and inside the orbit integral domain', () => {
  assert.deepEqual(geometry, discGeometry(DISC_SEED));
  assert.equal(geometry.innerRadius, DISC_INNER_RADIUS);
  assert.equal(geometry.outerRadius, DISC_OUTER_RADIUS);
  // One ring every 0.75 from 3 to 12, as upstream generates them.
  assert.equal(geometry.rings.length, 12);

  const other = discGeometry(DISC_SEED + 1);
  assert.equal(other.rings.length, geometry.rings.length);
  assert.notDeepEqual(other.rings, geometry.rings);
  // The seeded generator is consumed ring by ring, so another inner radius still gets the same
  // first-ring eccentricity and phase: the layout is reproducible, not accidentally re-derived.
  const wider = discGeometry(DISC_SEED, 4, 12);
  assert.equal(wider.rings[0]!.phi0, geometry.rings[0]!.phi0);
  assert.notEqual(wider.rings[0]!.u2, geometry.rings[0]!.u2);

  for (const ring of geometry.rings) {
    for (const value of Object.values(ring)) assert.ok(Number.isFinite(value));
    assert.ok(ring.u1 > 0 && ring.u1 < ring.u2);
    // u3 = 1 - u1 - u2 has to stay above u2, or the orbit integral has no real solution.
    assert.ok(ring.u2 < 1 - ring.u1 - ring.u2);
    assert.ok(ring.phi0 >= 0 && ring.phi0 < 2 * Math.PI);
    assert.ok(ring.dthetaDphi > 0 && ring.dthetaDphi < 0.5);
  }

  assert.throws(() => discGeometry(DISC_SEED, 0, DISC_OUTER_RADIUS), RangeError);
  assert.throws(() => discGeometry(DISC_SEED, DISC_OUTER_RADIUS, DISC_INNER_RADIUS), RangeError);
  // Below the photon sphere the ring formula has no real orbit: the scene fails, it does not draw.
  assert.throws(() => discGeometry(DISC_SEED, 1.2, DISC_OUTER_RADIUS), RangeError);
});

test('the disc constants are emitted in the upstream shader manager format', () => {
  const source = discParameterSource(geometry);
  assert.match(source, /const float INNER_DISC_R = 3\.00;/);
  assert.match(source, /const float OUTER_DISC_R = 12\.0;/);
  assert.match(source, /const int NUM_DISC_PARTICLES = 12;/);
  assert.match(source, /const vec4 DISC_PARTICLE_PARAMS\[12\] = vec4\[12\]\(/);
  assert.equal(source.match(/vec4\(/g)?.length, geometry.rings.length);
  // Three significant digits per component, as `${value.toPrecision(3)}` prints upstream.
  for (const token of source.match(/\d+\.\d+(?:e[+-]?\d+)?/gi) ?? []) {
    assert.equal(Number(token).toPrecision(3), token, token);
  }
  // Deterministic: the same seed always produces the same source.
  assert.equal(source, discParameterSource(discGeometry()));
});

test('the look constants are pinned and are the ones uploaded', () => {
  // The disc shading, the disc clock and the exposure of the output stage: the three numbers the
  // hero's look is built from, pinned here so a later tweak is a deliberate one.
  assert.deepEqual(DISC_LOOK, { density: 0.075, opacity: 0.42, temperature: 3500 });
  assert.equal(DISC_TIME_SCALE, 0.45);
  assert.equal(SCENE_EXPOSURE, 0.00011);
  // The scene uploads exactly those, as the three-component look uniform and the exposure.
  assert.match(
    sceneSource,
    /uniform3f\(uniforms\.disc_params, DISC_LOOK\.density, DISC_LOOK\.opacity, DISC_LOOK\.temperature\)/,
  );
  assert.match(sceneSource, /uniform1f\(uniforms\.exposure, SCENE_EXPOSURE\)/);
  // No uniform holds the look on the CPU side: the shader reads the density, opacity and temperature
  // from disc_params, so the pinned numbers really are what the frame is drawn with.
  assert.match(shader, /float density = disc_params\.x;/);
  assert.match(shader, /float opacity = disc_params\.y;/);
  assert.match(shader, /float temperature = disc_params\.z;/);
});

/**
 * A direct port of the upstream pipeline for a static observer
 * (`src/client/vendor/blackhole/source/model/model.js`): the 4-velocity of a stopped camera, the
 * rotation into its orbit frame at phi = 0, the boost that follows from that 4-velocity, the camera
 * rotation, and then the reference frame the shader is fed.
 */
function upstreamStaticObserver(radius: number, elevation: number, yaw: number, pitch: number) {
  const product = (a: number[][], b: number[][]) => {
    const c = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    for (let i = 0; i < 4; i += 1)
      for (let j = 0; j < 4; j += 1)
        for (let k = 0; k < 4; k += 1) c[i]![j]! += a[i]![k]! * b[k]![j]!;
    return c;
  };
  // vectorMatrixProduct(v, m): c[i] = sum_j v[j] * m[j][i], with the base vectors as rows of m.
  const apply = (v: number[], m: number[][]) => {
    const c = [0, 0, 0, 0];
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) c[i]! += v[j]! * m[j]![i]!;
    return c;
  };

  const u = 1 / radius;
  const phi = 0;
  const ci = Math.cos(elevation);
  const si = Math.sin(elevation);
  const worldTheta = Math.acos(Math.cos(phi) * si);
  const worldPhi = Math.atan2(Math.sin(phi), Math.cos(phi) * ci);
  const ct = Math.cos(worldTheta);
  const st = Math.sin(worldTheta);
  const cp = Math.cos(worldPhi);
  const sp = Math.sin(worldPhi);
  const ca = si * ct * cp + st * ci;
  const sa = si * sp;
  const orbitRot = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, ca, -sa],
    [0, 0, sa, ca],
  ];

  // The stopped camera's 4-velocity (1 / sqrt(1 - u), 0, 0, 0) normalises to (1, 0, 0, 0) in the
  // static observer's frame, so its boost is the identity: no boost terms have to be built.
  const kStatic = [1, 0, 0, 0];
  const boost = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const cameraRot = [
    [1, 0, 0, 0],
    [0, -sinY, 0, cosY],
    [0, -cosY * sinP, -cosP, -sinY * sinP],
    [0, cosY * cosP, -sinP, sinY * cosP],
  ];
  const lorentz = product(cameraRot, product(boost, orbitRot));

  const v = Math.sqrt(1 - u);
  const ur = [st * cp, st * sp, ct];
  const eStatic = [
    [1 / v, 0, 0, 0],
    [0, v * ur[0]!, v * ur[1]!, v * ur[2]!],
    [0, ct * cp, ct * sp, -st],
    [0, -sp, cp, 0],
  ];
  const frame = [0, 1, 2, 3].map((row) => apply(lorentz[row]!, eStatic));
  return {
    cameraPosition: [0, radius, worldTheta, worldPhi],
    p: [radius * ur[0]!, radius * ur[1]!, radius * ur[2]!],
    // k_s as the model stores it, and the spatial components of the four base vectors, which is
    // exactly what the demo hands the shader (`camera_view.js`).
    kS: [lorentz[0]![0]! / v, v * lorentz[0]![1]!, u * lorentz[0]![2]!, (u / st) * lorentz[0]![3]!],
    eTau: frame[0]!.slice(1),
    eW: frame[1]!.slice(1),
    eH: frame[2]!.slice(1),
    eD: frame[3]!.slice(1),
    kStatic,
  };
}

/**
 * The output stage's tone map, ported from `shader.ts` so its numbers can be checked without a GPU:
 * the upstream coefficients, the per-channel polynomial, the clamp and the display gamma, in the
 * order the shader applies them. The exposure is the caller's, as it is `main`'s.
 */
function toneMap(color: [number, number, number]): [number, number, number] {
  const A = 2.51;
  const B = 0.03;
  const C = 2.43;
  const D = 0.59;
  const E = 0.14;
  const channel = (value: number) => {
    const clamped = Math.max(value, 0);
    const mapped = (clamped * (A * clamped + B)) / (clamped * (C * clamped + D) + E);
    return Math.min(Math.max(mapped, 0), 1) ** (1 / 2.2);
  };
  return [channel(color[0]), channel(color[1]), channel(color[2])];
}

/** The curve the scene draws with: the tone map of a colour the exposure has already been applied to. */
function exposed(color: [number, number, number]): [number, number, number] {
  return toneMap([color[0] * SCENE_EXPOSURE, color[1] * SCENE_EXPOSURE, color[2] * SCENE_EXPOSURE]);
}

test('the camera reduction is the upstream pipeline for a static observer', () => {
  const poses = [
    // The upstream demo's own defaults, then this scene's pose, then the pointer extremes.
    { radius: Math.max(1 + 39 * 0.94 * 0.94, 1.01), elevation: Math.PI * (970 / 1799 - 0.5) },
    { radius: CAMERA_RADIUS, elevation: CAMERA_ELEVATION, yaw: 0, pitch: 0 },
    {
      radius: CAMERA_RADIUS,
      elevation: CAMERA_ELEVATION,
      yaw: POINTER_YAW_LIMIT,
      pitch: -POINTER_PITCH_LIMIT,
    },
    {
      radius: CAMERA_RADIUS,
      elevation: CAMERA_ELEVATION,
      yaw: -POINTER_YAW_LIMIT,
      pitch: POINTER_PITCH_LIMIT,
    },
    // Beyond the pointer limits: the reduction has to hold for any pose, not just the bounded one.
    { radius: 3.2, elevation: 0.4, yaw: 1.1, pitch: -0.9 },
  ];
  for (const pose of poses) {
    const actual = staticObserverUniforms({ ...pose, time: 0 });
    const upstream = upstreamStaticObserver(
      pose.radius,
      pose.elevation,
      pose.yaw ?? 0,
      pose.pitch ?? 0,
    );
    const compared: [string, number[], number[]][] = [
      ['cameraPosition', actual.cameraPosition, upstream.cameraPosition],
      ['p', actual.p, upstream.p],
      ['kS', actual.kS, upstream.kS],
      ['eTau', actual.eTau, upstream.eTau],
      ['eW', actual.eW, upstream.eW],
      ['eH', actual.eH, upstream.eH],
      ['eD', actual.eD, upstream.eD],
    ];
    const label = JSON.stringify(pose);
    for (const [name, got, want] of compared) {
      assert.equal(got.length, want.length, `${label}: ${name} length`);
      got.forEach((value, index) => {
        assert.ok(
          Math.abs(value - want[index]!) < 1e-12,
          `${label}: ${name}[${index}] is ${value}, upstream gives ${want[index]}`,
        );
      });
    }
    // The identity boost is what makes the reduction exact, so it is asserted, not assumed.
    assert.deepEqual(upstream.kStatic, [1, 0, 0, 0]);
  }
});

test('the camera stays finite, keeps its radius and looks at the black hole', () => {
  // The pose and the look-around the hero ships with, pinned so a change to the frame is deliberate:
  // a fixed radius well outside the disc, a low elevation, the upstream field of view, and a drift
  // that is much smaller than the upstream demo's free look.
  assert.equal(CAMERA_RADIUS, 30);
  assert.equal(CAMERA_ELEVATION, (6 * Math.PI) / 180);
  assert.equal(CAMERA_FOV_Y, (50 * Math.PI) / 180);
  assert.equal(POINTER_YAW_LIMIT, 0.09);
  assert.equal(POINTER_PITCH_LIMIT, 0.045);
  assert.equal(ORBIT_RATE, 3);

  const neutral = staticObserverUniforms({ time: 0 });
  assert.deepEqual(neutral.cameraPosition, [
    0,
    CAMERA_RADIUS,
    Math.acos(Math.sin(CAMERA_ELEVATION)),
    0,
  ]);
  assert.ok(Math.abs(Math.hypot(...neutral.p) - CAMERA_RADIUS) < 1e-12);
  assert.deepEqual(neutral.kS, [staticClockRate(CAMERA_RADIUS), 0, 0, 0]);
  assert.deepEqual(neutral.eTau, [0, 0, 0]);
  // e_d is the view direction of the centre pixel's ray, and it points outwards and upwards: the
  // shader looks along -e_d, so the singularity and the disc sit in front of the camera.
  const outward = Math.hypot(...neutral.eD);
  assert.ok(Math.abs(neutral.eD[0] / outward - Math.cos(CAMERA_ELEVATION)) < 1e-12);
  assert.ok(Math.abs(neutral.eD[1] / outward) < 1e-12);
  assert.ok(Math.abs(neutral.eD[2] / outward - Math.sin(CAMERA_ELEVATION)) < 1e-12);

  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
  ]) {
    const orbit = pointerOrbit({ x, y, active: true });
    assert.ok(Math.abs(orbit.yaw) <= POINTER_YAW_LIMIT);
    assert.ok(Math.abs(orbit.pitch) <= POINTER_PITCH_LIMIT);
    const pose = staticObserverUniforms({ time: 42.5, yaw: orbit.yaw, pitch: orbit.pitch });
    const values = [
      ...pose.cameraPosition,
      ...pose.p,
      ...pose.kS,
      ...pose.eTau,
      ...pose.eW,
      ...pose.eH,
      ...pose.eD,
    ];
    for (const value of values) assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(Math.hypot(...pose.p) - CAMERA_RADIUS) < 1e-12);
    assert.deepEqual(pose.kS, [staticClockRate(CAMERA_RADIUS), 0, 0, 0]);
  }

  // An inactive pointer returns to the neutral view, and finite input is forced into the bounds.
  assert.deepEqual(pointerOrbit({ x: 0.9, y: 0.9, active: false }), { yaw: 0, pitch: 0 });
  assert.deepEqual(pointerOrbit({ x: Number.NaN, y: Number.POSITIVE_INFINITY, active: true }), {
    yaw: 0,
    pitch: 0,
  });
  assert.deepEqual(pointerOrbit({ x: 40, y: -40, active: true }), {
    yaw: POINTER_YAW_LIMIT,
    pitch: -POINTER_PITCH_LIMIT,
  });

  // A pose that would put the camera on the horizon or at a pole fails the scene instead of
  // producing a black frame.
  assert.throws(() => staticObserverUniforms({ radius: 1 }), RangeError);
  assert.throws(() => staticObserverUniforms({ radius: Number.NaN }), RangeError);
  assert.throws(() => staticObserverUniforms({ time: Number.NaN }), RangeError);
  assert.throws(() => staticObserverUniforms({ elevation: Math.PI / 2 }), RangeError);
  assert.throws(() => staticObserverUniforms({ yaw: Number.POSITIVE_INFINITY }), RangeError);
  assert.throws(() => staticClockRate(0.5), RangeError);
  assert.throws(() => staticClockRate(Number.NaN), RangeError);
  assert.ok(staticClockRate(CAMERA_RADIUS) > 1);
});

test('the pointer orbit is bounded and converges without overshooting', () => {
  const target = 0.2;
  let value = 0;
  assert.equal(smoothToward(value, target, 0, ORBIT_RATE), 0);
  for (let step = 0; step < 300; step += 1) {
    const next = smoothToward(value, target, 1 / 30, ORBIT_RATE);
    assert.ok(Number.isFinite(next));
    assert.ok(next >= value && next <= target);
    value = next;
  }
  assert.ok(Math.abs(value - target) < 1e-6);
  assert.equal(smoothToward(Number.NaN, target, 1, ORBIT_RATE), target);
  assert.equal(smoothToward(0.5, Number.NaN, 1, ORBIT_RATE), 0.5);
  assert.equal(smoothToward(0.5, target, Number.NaN, ORBIT_RATE), 0.5);
  // The delta is clamped, so a throttled or resumed tab cannot jump the view.
  const jumped = smoothToward(0, 1, 1000, ORBIT_RATE);
  assert.ok(jumped > 0 && jumped < 0.26);
});

test('the disc clock is far slower than the upstream demo rate', () => {
  // The demo advances the observer's Schwarzschild time at C^3 / (2 G M) per proper second, with
  // its default mass slider (index 384: 10 * 10^(6 * 0.384) solar masses) and start conditions
  // (r = 1 + 39 * 0.94^2, v = 0.347^2), so dt/dTau = e / (1 - u).
  const mass = 10 * 10 ** (6 * 0.384) * 1.98847e30;
  const radius = Math.max(1 + 39 * 0.94 * 0.94, 1.01);
  const u = 1 / radius;
  const e = Math.sqrt((1 - u) / (1 - 0.347 ** 4));
  const upstreamPerSecond = (299792458 ** 3 / (2 * 6.6743e-11 * mass)) * (e / (1 - u));
  assert.ok(upstreamPerSecond > 40 && upstreamPerSecond < 60, `${upstreamPerSecond}`);
  // What this scene feeds the shader instead, per wall second.
  const scenePerSecond = DISC_TIME_SCALE / staticClockRate(CAMERA_RADIUS);
  assert.ok(scenePerSecond > 0);
  // Without that, the disc pattern would turn over about once a second.
  assert.ok(upstreamPerSecond / scenePerSecond > 20);
});

test('every reused function is the upstream body', () => {
  // DefaultDiscColor is deliberately absent: it is upstream's body plus the hero's own look, and the
  // next test pins that difference one change at a time.
  const reused: [keyof typeof SOURCES, string][] = [
    ['functions', 'GetRayDeflectionTextureUFromEsquare'],
    ['functions', 'GetUapsisFromEsquare'],
    ['functions', 'GetRayDeflectionTextureVFromEsquareAndU'],
    ['functions', 'GetTextureCoordFromUnitRange'],
    ['functions', 'LookupRayDeflection'],
    ['functions', 'GetPhiUbFromEsquare'],
    ['functions', 'GetRayInverseRadiusTextureUFromEsquare'],
    ['functions', 'LookupRayInverseRadius'],
    ['functions', 'FilteredPulse'],
    ['functions', 'TraceRay'],
    ['model', 'DefaultDoppler'],
    ['model', 'BlackBodyColor'],
    ['model', 'SceneColor'],
  ];
  for (const [file, name] of reused) {
    const upstream = glslDefinitions(readText(SOURCES[file]), name);
    const deployed = glslDefinitions(shader, name);
    assert.ok(upstream.length > 0, `${name} is missing from ${SOURCES[file]}`);
    assert.equal(deployed.length, upstream.length, `${name}: definition count`);
    upstream.forEach((body, index) => {
      assert.equal(deployed[index], body, `${name} #${index} differs from upstream`);
    });
  }
  // The two TraceRay overloads are both needed: the shader's RayTrace calls the long one.
  assert.equal(glslDefinitions(shader, 'TraceRay').length, 2);
  assert.equal(glslDefinitions(shader, 'LookupRayDeflection').length, 1);
});

test('the disc shading is the upstream body with four marked look changes', () => {
  const upstream = glslDefinitions(readText(SOURCES.model), 'DefaultDiscColor');
  assert.equal(upstream.length, 1);
  const deployed = glslDefinitions(shader, 'DefaultDiscColor');
  assert.equal(deployed.length, 1);
  const body = deployed[0]!;
  assert.notEqual(body, upstream[0]!);

  // The per-ring loop is upstream's: the same orbit terms, the same ring constants, and the same
  // noise tap on the same scaled coordinates. The disc noise is per ring, not per pixel.
  for (const token of [
    'for (int i = 0; i < NUM_DISC_PARTICLES; ++i)',
    'vec4 params = DISC_PARTICLE_PARAMS[i];',
    'float u_avg = (u1 + u2) * 0.5;',
    'float dphi_dt = u_avg * sqrt(0.5 * u_avg);',
    'float phi = dphi_dt * p_t + phi0;',
    'float a = mod(p_phi - phi, 2.0 * pi);',
    'float r = 1.0 / (u1 + (u2 - u1) * s * s);',
    'vec2 d = vec2(a - pi, r - p_r) * vec2(1.0 / pi, 0.5);',
    'float noise = Noise(d * vec2(p_r / OUTER_DISC_R, 1.0));',
  ]) {
    assert.ok(body.includes(token), token);
  }

  // Change 1: the reversed-edge smoothstep, which GLSL leaves undefined, written in the defined
  // forward order. Same ramp, same result.
  assert.match(body, /density \+= \(1\.0 - smoothstep\(0\.0, 1\.0, length\(d\)\)\) \* noise;/);
  // Change 2: the filament modulation of the summed density. The phase drifts with the disc clock
  // and the two grains come from the existing disc noise; both gates are clamped non-negative, so
  // the density is only ever scaled, never inverted.
  assert.match(body, /float phase = p_phi - 0\.004 \* p_t;/);
  assert.match(
    body,
    /float grain_coarse = clamp\(Noise\(vec2\(p_r \* 0\.45, phase \* 1\.3\)\) \* 0\.4, 0\.0, 1\.0\);/,
  );
  assert.match(
    body,
    /float grain_fine = clamp\(Noise\(vec2\(p_r \* 5\.5 \+ 0\.35 \* sin\(phase \* 3\.0\), phase \* 0\.8\)\) \* 0\.4, 0\.0, 1\.0\);/,
  );
  assert.equal(body.match(/clamp\(Noise\(vec2\(/g)?.length, 2);
  assert.equal(body.match(/\) \* 0\.4, 0\.0, 1\.0\)/g)?.length, 2);
  assert.match(
    body,
    /density = max\(density, 0\.0\) \* \(0\.30 \+ 0\.70 \* grain_coarse\) \* \(0\.12 \+ 1\.8 \* grain_fine \* grain_fine\);/,
  );
  // Change 3: the temperature profile's base, which is negative inside the inner edge, is clamped
  // before pow() rather than handed to it.
  assert.match(
    body,
    /pow\(max\(\(1\.0 - sqrt\(3\.0 \/ p_r\)\) \/ \(p_r \* p_r \* p_r\), 0\.0\), 0\.25\)/,
  );
  // Change 4: the outer edge of the alpha ramp, which upstream writes with its edges reversed as
  // well, in the defined forward order. The inner edge of the ramp is upstream's own and untouched.
  assert.match(body, /float alpha = smoothstep\(INNER_DISC_R, INNER_DISC_R \* 1\.2, p_r\) \*/);
  assert.match(body, /\(1\.0 - smoothstep\(OUTER_DISC_R \/ 1\.2, OUTER_DISC_R, p_r\)\)/);
  assert.doesNotMatch(body, /smoothstep\(OUTER_DISC_R, OUTER_DISC_R \/ 1\.2, p_r\)/);
  // Nothing else moved: undoing those four changes has to give the upstream body back exactly, so
  // there is no fifth silent difference hiding in the deployed text.
  const restored = body
    .replace(
      /float phase = [^;]+; float grain_coarse = [^;]+; float grain_fine = [^;]+; density = max\(density, 0\.0\) \* \(0\.30 \+ 0\.70 \* grain_coarse\) \* \(0\.12 \+ 1\.8 \* grain_fine \* grain_fine\);/,
      '',
    )
    .replace(
      'density += (1.0 - smoothstep(0.0, 1.0, length(d))) * noise;',
      'density += smoothstep(1.0, 0.0, length(d)) * noise;',
    )
    .replace(
      'pow(max((1.0 - sqrt(3.0 / p_r)) / (p_r * p_r * p_r), 0.0), 0.25)',
      'pow((1.0 - sqrt(3.0 / p_r)) / (p_r * p_r * p_r), 0.25)',
    )
    .replace(
      /\(1\.0 - smoothstep\(OUTER_DISC_R \/ 1\.2, OUTER_DISC_R, p_r\)\)/,
      'smoothstep(OUTER_DISC_R, OUTER_DISC_R / 1.2, p_r)',
    )
    .replace(/\s+/g, ' ')
    .trim();
  assert.equal(restored, upstream[0]!);
});

test('the lookup constants and type macros come from the upstream sources', () => {
  for (const macro of glslMacros(readText(`${VENDOR}/source/definitions.glsl`))) {
    assert.ok(compactGlsl(shader).includes(macro), macro);
  }
  // kMu is the horizon-crossing threshold both TraceRay overloads branch on.
  assert.match(shader, /const Real kMu = 4\.0 \/ 27\.0;/);
  assert.equal(shader.includes(`const float pi = ${Math.PI};`), true);
  assert.match(shader, /const float rad = 1\.0;/);
});

test('the assembled shader pins the defines, the tables and its inputs', () => {
  assert.match(shader, /^#version 300 es\nprecision highp float;\n/);
  assert.match(shader, /#define LENSING 1\b/);
  assert.match(shader, /#define DOPPLER 1\b/);
  assert.match(shader, /#define GRID 0\b/);
  assert.match(shader, /#define STARS 0\b/);
  assert.doesNotMatch(stripComments(shader), /#define (LENSING|DOPPLER) 0|#define (GRID|STARS) 1/);
  assert.doesNotMatch(shader, /\$\{/);
  // The two sampled tables carry their sizes as constants, taken from the specifications the
  // uploader uses, so the shader's lookups and the uploaded textures cannot drift apart.
  const emitted = Object.fromEntries(
    [...shader.matchAll(/const int (RAY_\w+) = (\d+);/g)].map((match) => [match[1]!, match[2]!]),
  );
  assert.deepEqual(emitted, {
    RAY_DEFLECTION_TEXTURE_WIDTH: String(LUTS.deflection.width),
    RAY_DEFLECTION_TEXTURE_HEIGHT: String(LUTS.deflection.height),
    RAY_INVERSE_RADIUS_TEXTURE_WIDTH: String(LUTS.inverseRadius.width),
    RAY_INVERSE_RADIUS_TEXTURE_HEIGHT: String(LUTS.inverseRadius.height),
  });
  // The disc block is generated from the seeded geometry, not hand-written.
  assert.equal(shader.includes(discParameterSource(geometry)), true);
  // The shared fullscreen triangle is reused as is; vUv replaces the demo's quad attribute.
  const glSource = readText('src/client/algorithms/gl.ts');
  assert.equal(vertexSource, /FULLSCREEN_VERTEX = `([^`]*)`/.exec(glSource)?.[1]);
  assert.match(vertexSource, /out vec2 vUv;/);
  assert.match(vertexSource, /gl_VertexID/);
  assert.match(shader, /in vec2 vUv;/);
  for (const uniform of [
    'uniform vec4 camera_position;',
    'uniform vec3 p;',
    'uniform vec4 k_s;',
    'uniform vec3 e_tau, e_w, e_h, e_d;',
    'uniform vec3 camera_size;',
    'uniform vec2 view_center;',
    'uniform vec3 disc_params;',
    'uniform float exposure;',
    'uniform uvec3 star_seed;',
    'uniform sampler2D ray_deflection_texture;',
    'uniform sampler2D ray_inverse_radius_texture;',
    'uniform sampler2D black_body_texture;',
    'uniform highp sampler3D doppler_texture;',
    'uniform sampler2D noise_texture;',
  ]) {
    assert.equal(shader.includes(uniform), true, uniform);
  }
  // The view direction is the upstream vertex expression, derived from vUv instead of a quad and
  // centred on the framed point rather than on the middle of the viewport.
  assert.match(
    shader,
    /vec3 view_dir = vec3\(\(vUv - view_center\) \* 2\.0 \* camera_size\.xy, -camera_size\.z\);/,
  );
  assert.match(shader, /SceneColor\(camera_position, p, k_s, e_tau, e_w, e_h, e_d, view_dir\)/);
  // Balance of the delimiters a template assembly could break.
  const code = stripComments(shader);
  for (const [open, close] of [
    ['{', '}'],
    ['(', ')'],
  ] as const) {
    assert.equal(code.split(open).length, code.split(close).length, `unbalanced ${open}`);
  }
});

test('no Gaia, Tycho, rocket or bloom path survives in the shader', () => {
  const code = stripComments(shader);
  assert.doesNotMatch(code, /samplerCube/);
  assert.doesNotMatch(
    code,
    /galaxy_cube_texture|star_cube_texture|stars_orientation|min_stars_lod/,
  );
  assert.doesNotMatch(code, /DefaultStarColor|StarTextureColor|TraceRayEuclidean|GridDiscColor/);
  assert.doesNotMatch(code, /bloom/i);
  // The HDR colour is tone mapped in the fragment, so there is no float target and no second pass.
  assert.match(code, /vec3 ToneMapACES\(vec3 color\)/);
  assert.match(code, /pow\(clamp\(mapped, 0\.0, 1\.0\), vec3\(1\.0 \/ 2\.2\)\)/);
  assert.match(code, /frag_color = vec4\(ToneMapACES\(/);
  assert.doesNotMatch(code, /DOPPLER == 0/);
  // The procedural sky is in: hash points, a value-noise nebula, a seeded band.
  assert.match(code, /float CellHash\(uvec3 cell\)/);
  const starColor = glslDefinitions(shader, 'StarColor');
  assert.equal(starColor.length, 1);
  assert.match(
    starColor[0]!,
    /^vec3 StarColor\(vec3 dir, float lensing_amplification_factor\) \{ return vec3\(0\.0\); \}$/,
  );
  const [bandX, bandY, bandZ] = SKY_BAND_DIRECTION;
  assert.ok(Math.abs(Math.hypot(bandX, bandY, bandZ) - 1) < 1e-12);
  assert.equal(shader.includes(`vec3 SKY_BAND_NORMAL = vec3(${bandX.toFixed(5)}`), true);
  for (const seed of STARFIELD_SEED) {
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32, `${seed}`);
  }
});

test('the tone map is the ACES shoulder per channel and keeps the frame in range', () => {
  // The shader really is the port below, line by line: upstream's coefficients, the polynomial on
  // each channel, the clamp and the display gamma.
  const code = compactGlsl(shader);
  assert.match(code, /const float A = 2\.51;/);
  assert.match(code, /const float B = 0\.03;/);
  assert.match(code, /const float C = 2\.43;/);
  assert.match(code, /const float D = 0\.59;/);
  assert.match(code, /const float E = 0\.14;/);
  assert.match(code, /color = max\(color, vec3\(0\.0\)\);/);
  assert.match(
    code,
    /vec3 mapped = \(color \* \(A \* color \+ B\)\) \/ \(color \* \(C \* color \+ D\) \+ E\);/,
  );
  assert.match(code, /return pow\(clamp\(mapped, 0\.0, 1\.0\), vec3\(1\.0 \/ 2\.2\)\);/);
  // The luminance the curve used to be applied to, the ratio that carried the colour through it and
  // the peak the result used to be divided by are all gone: the curve is per channel again.
  assert.doesNotMatch(code, /luminance|LUMA|fitted|peak/);
  // The per-channel ceiling that used to sit in front of the curve is gone too: a very bright pixel
  // is placed by the shoulder, not truncated before it.
  assert.doesNotMatch(code, /min\(color \* exposure/);
  assert.match(code, /frag_color = vec4\(ToneMapACES\(color \* exposure\), 1\.0\);/);

  // Reference values: a neutral grey of 0.18 and a white of 1.0 land exactly where upstream's own
  // curve puts them, since a neutral is the same curve whichever way it is applied.
  for (const channel of toneMap([0.18, 0.18, 0.18])) {
    assert.ok(Math.abs(channel - 0.54859084) < 1e-8, `${channel}`);
  }
  for (const channel of toneMap([1, 1, 1])) {
    assert.ok(Math.abs(channel - 0.90549245) < 1e-8, `${channel}`);
  }

  // Black stays black, and no scene colour reaches the output as NaN or as a negative channel,
  // however odd it is: a disc density below zero, a saturated primary, or a radiance far past the
  // display range.
  assert.deepEqual(toneMap([0, 0, 0]), [0, 0, 0]);
  for (const sample of [
    [-1, -1, -1],
    [-0.5, 0.2, 0.05],
    [0, 4, 0],
    [1e12, 3e5, 12],
    [1e30, 1e30, 1e30],
    [Number.MIN_VALUE, 0, 0],
  ] as [number, number, number][]) {
    for (const channel of toneMap(sample)) {
      assert.ok(Number.isFinite(channel), `${sample}: ${channel}`);
      assert.ok(channel >= 0 && channel <= 1, `${sample}: ${channel}`);
    }
  }
  // Radiance far past the display range lands on white, not at infinity.
  assert.deepEqual(toneMap([1e12, 1e12, 1e12]), [1, 1, 1]);

  // The curve is monotone: one hue sampled at a rising intensity never comes back lower in any
  // channel, so a brighter pixel of a colour is never drawn darker than a dimmer one of it.
  for (const hue of [
    [1, 1, 1],
    [1, 0.55, 0.3],
    [1, 0.03, 0.006],
  ] as [number, number, number][]) {
    let previous = [0, 0, 0];
    for (const intensity of [1e-4, 1e-3, 1e-2, 0.1, 1, 2, 7, 8, 100, 1e4, 1e8]) {
      const output = toneMap([hue[0] * intensity, hue[1] * intensity, hue[2] * intensity]);
      output.forEach((channel, index) => {
        assert.ok(channel >= previous[index]!, `${hue} at ${intensity}: channel ${index}`);
        previous[index] = channel;
      });
    }
  }

  // At the exposure the scene uploads, a sweep of disc radiances stays below the shoulder: the four
  // greys come out in order, distinct and unsaturated, which is the gradation the low exposure is
  // there to keep. Five times that exposure lifts all four, so the render parameter really is the
  // one the curve is fed.
  const greys = [0.05, 0.2, 0.7, 2] as const;
  const dim = greys.map((grey) => exposed([grey, grey, grey])[0]);
  let previousGrey = -1;
  for (const channel of dim) {
    assert.ok(channel > previousGrey && channel < 1, `${channel}`);
    previousGrey = channel;
  }
  greys.forEach((grey, index) => {
    const lifted = exposed([grey * 5, grey * 5, grey * 5])[0];
    assert.ok(lifted > dim[index]!, `${grey}: ${lifted}`);
  });

  // A red-dominant highlight is allowed to desaturate: the shoulder is asymptotic, so the other two
  // channels of a bright red core catch up with the red instead of the core clipping to a flat red.
  // The dim red of the same hue still reads as red.
  const red = toneMap([1, 0.02, 0.004]);
  assert.ok(red[0] > 0.8 && red[1] < 0.2 && red[2] < 0.1, `${red}`);
  let ratios: [number, number] = [0, 0];
  for (const intensity of [1, 2, 5, 10, 100, 1000, 1e4, 1e6]) {
    const [r, g, b] = toneMap([intensity, 0.02 * intensity, 0.004 * intensity]);
    assert.ok(g / r >= ratios[0] && b / r >= ratios[1], `at ${intensity}`);
    ratios = [g / r, b / r];
  }
  assert.deepEqual(toneMap([1e6, 2e4, 4e3]), [1, 1, 1]);
});

test('the procedural sky is seeded, pure and actually uploaded', () => {
  const sky = ['GalaxyColor', 'StarLayer', 'SkyFbm', 'SkyNoise', 'SkyCell', 'CellHash3', 'CubeFace']
    .map((name) => glslDefinitions(shader, name).join('\n'))
    .join('\n');
  assert.ok(sky.length > 0);
  // The sky is a function of the direction and the fixed seed only: no time, no camera, no disc.
  assert.match(sky, /star_seed/);
  assert.doesNotMatch(sky, /camera_position|camera_size|disc_params|exposure|camera_position\[0\]/);
  // Same geometry, same shader; another disc geometry is another shader.
  assert.equal(fragmentSource(geometry), shader);
  assert.notEqual(fragmentSource(discGeometry(DISC_SEED + 7)), shader);
  // The seed is a uniform, and the scene has to upload it for the sky to be deterministic.
  const scene = readText('src/client/algorithms/blackhole/scene.ts');
  assert.match(scene, /uniform3ui\(uniforms\.star_seed, \.\.\.STARFIELD_SEED\)/);
  // The hero runtime owns the frame loop and the listeners: this scene schedules nothing and
  // listens on nothing but the abort signal it is handed.
  const code = stripComments(scene);
  assert.doesNotMatch(code, /requestAnimationFrame/);
  assert.doesNotMatch(code, /addEventListener\(\s*['"](?!abort)/);
  assert.equal((code.match(/addEventListener\(/g) ?? []).length, 1);
  assert.doesNotMatch(code, /EXT_color_buffer_float|EXT_float_blend|drawBuffers|\.blend/);
});

test('the starfield cell is lifted to 3D with an explicit zero component', () => {
  // The lift sits on one source line, as it does in the generated shader, and the face index still
  // separates the six lattices in the salt term beside it.
  const lift = '  vec3 h = CellHash3(SkyCell(ivec3(ivec2(cell), 0)) + uvec3(face) + salt);';
  assert.equal(shader.includes(`\n${lift}\n`), true);
  assert.doesNotMatch(shader, /ivec3\(cell\)/);
  // The cell really is 2D where it is lifted, which is what required the explicit component.
  const starLayer = glslDefinitions(shader, 'StarLayer')[0]!;
  assert.match(starLayer, /vec2 cell = floor\(grid\);/);
  assert.match(
    starLayer,
    /vec2 faceUv, uint face, float cells, float size, float gain, uvec3 salt/,
  );
  assert.match(starLayer, /SkyCell\(ivec3\(ivec2\(cell\), 0\)\) \+ uvec3\(face\) \+ salt/);
});

test('the sky keeps its deterministic field and only its star gains come down', () => {
  const starLayer = glslDefinitions(shader, 'StarLayer')[0]!;
  const galaxy = glslDefinitions(shader, 'GalaxyColor')[0]!;
  // The magnitude law is steeper, so the faint masses drop away and only the bright cores survive:
  // this is the star speckle the hero takes out, and it is a change inside StarLayer alone.
  assert.match(starLayer, /float magnitude = pow\(h\.z, 12\.0\);/);
  assert.doesNotMatch(starLayer, /pow\(h\.z, 5\.0\)/);
  // The three layers keep their grids, their sizes and their salts, and take the quieter gains.
  for (const [layer, salt] of [
    ['42.0, 0.10, 12.0', 'uvec3(0u)'],
    ['86.0, 0.11, 24.0', 'uvec3(17u, 29u, 43u)'],
    ['21.0, 0.09, 90.0', 'uvec3(97u, 71u, 53u)'],
  ] as [string, string][]) {
    assert.equal(galaxy.includes(`StarLayer(faceUv, face, ${layer}, ${salt})`), true, layer);
  }
  // The nebula, the band and the ambient tint keep the levels they had: the sky gains brightness
  // nowhere, so the disc stays the brightest thing on the frame.
  assert.match(galaxy, /vec3 color = SKY_DUST_COLOR \* \(10\.0 \* dust \* dust\);/);
  assert.match(galaxy, /color \+= SKY_BAND_COLOR \* \(9\.0 \* band \* dust\);/);
  assert.match(galaxy, /color \+= SKY_DUST_COLOR \* SKY_AMBIENT;/);
  // The draw is still the seeded hash of the direction, reached through the same cube-face lattice.
  assert.match(galaxy, /CubeFace\(d, face\)/);
  assert.match(
    starLayer,
    /CellHash3\(SkyCell\(ivec3\(ivec2\(cell\), 0\)\) \+ uvec3\(face\) \+ salt\)/,
  );
});

test('the frame centre switches layout at the chosen aspect', () => {
  // Wide: the subject sits right of the copy, at the middle of the height. Narrow: it is centred
  // horizontally and low, so the copy above it is clear. The threshold itself is the wide layout.
  assert.deepEqual(blackHoleFraming(VIEW_CENTER_ASPECT), [0.7, 0.5]);
  for (const aspect of [1.2, 1.3333, 1.6, 1.7777, 2.4, 21 / 9]) {
    assert.deepEqual(blackHoleFraming(aspect), [0.7, 0.5], `${aspect}`);
  }
  for (const aspect of [1.1499, 1.15 - 1e-9, 1, 0.75, 0.5, 390 / 844]) {
    assert.deepEqual(blackHoleFraming(aspect), [0.5, 0.34], `${aspect}`);
  }
  // y counts up from the bottom, so the narrow layout puts the subject in the lower 66% of the
  // height, and the wide layout keeps it right of centre.
  assert.ok(Math.abs(1 - blackHoleFraming(1)[1] - 0.66) < 1e-12);
  assert.ok(blackHoleFraming(2)[0] > 0.5 && blackHoleFraming(1)[1] < 0.5);
  // An aspect that is not a usable number gets the narrow layout: the subject stays clear of the
  // copy rather than the frame reverting to a centred view.
  for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(blackHoleFraming(aspect), [0.5, 0.34], `${aspect}`);
  }
  // A caller gets its own pair and cannot move the layout for everyone else.
  const pair = blackHoleFraming(1.6);
  pair[0] = 0.5;
  pair[1] = 0.5;
  assert.deepEqual(blackHoleFraming(1.6), [0.7, 0.5]);
});

test('the hero budget never moves the framing', () => {
  const full = algorithmBudget('blackhole', false);
  const light = algorithmBudget('blackhole', true);
  // A desktop box, a tablet box and two phone boxes, at the device ratios they actually report.
  const boxes: [number, number, number][] = [
    [1440, 900, 2],
    [1920, 1080, 1],
    [1024, 1366, 2],
    [390, 844, 3],
    [360, 780, 2],
  ];
  for (const [width, height, deviceRatio] of boxes) {
    const candidate = algorithmResolution(width, height, full, 1, deviceRatio);
    const framing = blackHoleFraming(candidate.width / candidate.height);
    // The budget only scales the drawable: every quality step keeps the same composition, and the
    // drawable's aspect stays on the same side of the threshold as the box it was sized from.
    for (const [budget, scale] of [
      [full, 0.8],
      [full, 0.65],
      [light, 1],
      [light, 0.65],
    ] as [typeof full, number][]) {
      const other = algorithmResolution(width, height, budget, scale, deviceRatio);
      assert.deepEqual(blackHoleFraming(other.width / other.height), framing, `${width}x${height}`);
    }
    const boxAspect = width / height;
    assert.equal(
      candidate.width / candidate.height >= VIEW_CENTER_ASPECT,
      boxAspect >= VIEW_CENTER_ASPECT,
      `${width}x${height}`,
    );
    assert.deepEqual(framing, boxAspect >= VIEW_CENTER_ASPECT ? [0.7, 0.5] : [0.5, 0.34]);
  }
  // The landscape and portrait boxes really do land on opposite sides of the switch.
  assert.deepEqual(
    blackHoleFraming(algorithmResolution(1440, 900, full, 1, 2).width / 900),
    [0.7, 0.5],
  );
  assert.deepEqual(
    blackHoleFraming(algorithmResolution(390, 844, full, 1, 3).width / 844),
    [0.5, 0.34],
  );
  // The scene uploads the centre from that same function and that same aspect, on resize.
  const scene = readText('src/client/algorithms/blackhole/scene.ts');
  assert.match(
    scene,
    /uniform2f\(\s*uniforms\.view_center,\s*\.\.\.blackHoleFraming\(resolution\.width \/ resolution\.height\),?\s*\)/,
  );
});
