// Verbatim GLSL noise primitives copied from the fixed upstream revision
// ZyFou/ProceduralTerrains @ f58a8ddb81d1fbb526a41282a9a7e9c05c2d2070 (MIT).
//
//   NOISE_GLSL              <- src/engine/terrain/terrainGLSL.js
//   NOISE_STACK_PRIMS2D_GLSL <- src/engine/terrain/noise/noisePrimsGLSL.js
//
// The GLSL text below is unchanged. The upstream 3D primitives
// (NOISE_STACK_PRIMS3D_GLSL) and the codegen/mask/stack modules are not copied:
// this scene only needs the 2D primitives. NOISE_GLSL's fbm / ridgedFBM read
// OCTAVES, uPersistence and uLacunarity from the includer, exactly as upstream's
// material does, so the shader that includes this file must define them.
// See README.md in this directory for the license and adaptation notes.

export const NOISE_GLSL = /* glsl */ `
// --- hash without sine precision issues (Dave Hoskins) -----------------------
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// --- quintic value noise -----------------------------------------------------
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT2 = mat2(0.80, -0.60, 0.60, 0.80);

// NOTE: all loop bounds are compile-time constants (OCTAVES is a #define
// injected by the material). Dynamic trip counts / breaks make ANGLE's
// D3D11 shader compiler hang while trying to unroll, so avoid them here.

// --- standard FBM at full octave count (rolling hills / plains) --------------
float fbm(vec2 p) {
  float amp = 0.5;
  float sum = 0.0;
  float norm = 0.0;
  for (int i = 0; i < OCTAVES; i++) {
    sum += amp * vnoise(p);
    norm += amp;
    amp *= uPersistence;
    p = ROT2 * p * uLacunarity;
  }
  return sum / max(norm, 1e-4);
}

// --- low-cost 4-octave FBM (domain warp, masks, moisture) --------------------
float fbm4(vec2 p) {
  float amp = 0.5;
  float sum = 0.0;
  float norm = 0.0;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    norm += amp;
    amp *= uPersistence;
    p = ROT2 * p * uLacunarity;
  }
  return sum / max(norm, 1e-4);
}

// --- ridged multifractal (mountain chains) -----------------------------------
float ridgedFBM(vec2 p) {
  float amp = 0.5;
  float sum = 0.0;
  float norm = 0.0;
  float carry = 1.0;
  for (int i = 0; i < OCTAVES; i++) {
    float v = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    v = v * v;
    sum += amp * v * carry;     // spectral weighting: detail follows ridges
    carry = clamp(v * 1.4, 0.0, 1.0);
    norm += amp;
    amp *= uPersistence;
    p = ROT2 * p * uLacunarity;
  }
  return sum / max(norm, 1e-4);
}
`;

export const NOISE_STACK_PRIMS2D_GLSL = /* glsl */ `
// value noise plus analytic derivatives. The .x channel intentionally matches
// vnoise(p): same hash corners, same quintic interpolant, same mix order.
vec3 vnoised2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f - 1.0) * (f - 1.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  float top = mix(a, b, u.x);
  float bot = mix(c, d, u.x);
  float value = mix(top, bot, u.y);
  vec2 deriv = vec2(
    mix(b - a, d - c, u.y) * du.x,
    (bot - top) * du.y
  );
  return vec3(value, deriv);
}

// value noise with selectable interpolation (0 linear, 1 smooth, 2 quintic)
float valueNoise2(vec2 p, int mode) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = mode == 0 ? f
         : mode == 1 ? f * f * (3.0 - 2.0 * f)
         : f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// blocky white noise, optionally smoothed toward value noise
float whiteNoise2(vec2 p, float smoothAmt) {
  float blocky = hash12(floor(p) + 0.5);
  return mix(blocky, vnoise(p), clamp(smoothAmt, 0.0, 1.0));
}

// Voronoi / cellular. dmode: 0 euclidean, 1 manhattan, 2 chebyshev.
// omode: 0 cell value, 1 dist-to-center(F1), 2 dist-to-edge(F2-F1), 3 edge lines.
float voronoi2(vec2 p, float jitter, int dmode, int omode) {
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0;
  float cellRnd = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash12(ip + g), hash12(ip + g + vec2(41.3, 13.7)));
      vec2 r = g + o * jitter - fp;
      float d = dmode == 0 ? dot(r, r)
              : dmode == 1 ? abs(r.x) + abs(r.y)
              : max(abs(r.x), abs(r.y));
      if (d < f1) { f2 = f1; f1 = d; cellRnd = hash12(ip + g + vec2(7.1, 91.7)); }
      else if (d < f2) { f2 = d; }
    }
  }
  float d1 = dmode == 0 ? sqrt(f1) : f1;
  float d2 = dmode == 0 ? sqrt(f2) : f2;
  if (omode == 0) return clamp(cellRnd, 0.0, 1.0);
  if (omode == 1) return clamp(d1, 0.0, 1.0);
  if (omode == 2) return clamp(d2 - d1, 0.0, 1.0);
  return clamp(1.0 - (d2 - d1) * 3.0, 0.0, 1.0);
}

// Impact craters: depressed bowl + raised rim, distributed one-per-cell, gated
// by density. Returns a signed value (~ -depth .. +rim), centered near 0.
float crater2(vec2 p, float density, float depth, float rim, float rimWidth) {
  vec2 ip = floor(p), fp = fract(p);
  float best = 8.0, rnd = 0.0, rad = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash12(ip + g), hash12(ip + g + vec2(23.7, 5.9)));
      float d = length(g + o - fp);
      if (d < best) { best = d; rnd = hash12(ip + g + vec2(61.1, 7.3)); }
    }
  }
  if (rnd > density) return 0.0;
  float radius = mix(0.18, 0.46, hash12(ip + vec2(rnd * 17.0)));
  float t = best / max(radius, 0.02);
  float bowl = -depth * (1.0 - smoothstep(0.0, 1.0, t));
  float rimv = rim * exp(-pow((t - 1.0) / max(rimWidth, 0.02), 2.0));
  return bowl + rimv;
}

// Wind-shaped dunes: ridges perpendicular to wind direction + fine ripples.
float dune2(vec2 p, float windDir, float sharp, float rippleScale, float rippleStr) {
  vec2 dir = vec2(cos(windDir), sin(windDir));
  float across = dot(p, vec2(-dir.y, dir.x));
  float along = dot(p, dir);
  float warp = (vnoise(p * 0.5) - 0.5) * 2.0;
  float dunes = 1.0 - abs(sin(across + warp));
  dunes = pow(clamp(dunes, 0.0, 1.0), max(sharp, 0.1));
  float ripples = (vnoise(vec2(across * rippleScale, along * 0.3)) - 0.5) * rippleStr;
  return clamp(dunes + ripples, 0.0, 1.0);
}

// Flow / river channels: gaussian valley along a meandering direction.
// Returns the channel mask 0..1 (1 inside the channel) — pair with subtract/carve.
float flow2(vec2 p, float flowDir, float width, float meander, float meanderScale) {
  vec2 dir = vec2(cos(flowDir), sin(flowDir));
  float across = dot(p, vec2(-dir.y, dir.x));
  float along = dot(p, dir);
  across += (vnoise(vec2(along * meanderScale, 13.1)) - 0.5) * meander;
  return clamp(exp(-pow(across / max(width, 0.02), 2.0)), 0.0, 1.0);
}
`;
