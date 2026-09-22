/**
 * GLSL for the black hole scene.
 *
 * The ray tracing is the upstream model's text, reused from commit
 * `e72b3f293409893a6fa25528f29572c96fc57f57` (BSD-3-Clause): `black_hole/definitions.glsl`,
 * `black_hole/functions.glsl` and `black_hole/model.glsl` are reproduced verbatim apart from their
 * documentation comments, and the shader-level glue (`RayTrace`, `Doppler`, `DiscColor`, `Noise`,
 * `main`) follows `demo/camera_view/fragment_shader.glsl`. The pristine upstream files are in
 * `src/client/vendor/blackhole/source/`, and `src/client/vendor/blackhole/README.md` lists every
 * difference: the Gaia/Tycho sky is replaced by a procedural starfield, the dead branches of the
 * fixed defines are dropped, `DefaultStarColor` and the star cube maps are gone with `STARS 0`, and
 * the output stage tone maps locally instead of building the upstream float bloom.
 */

import { FULLSCREEN_VERTEX } from '../gl';
import { discParameterSource, type DiscGeometry } from './disc';
import { LUTS } from './lut';

/** The fullscreen triangle, shared with the other algorithm scenes; view_dir is derived from vUv. */
export const vertexSource = FULLSCREEN_VERTEX;

/** Fixed starfield seed: the sky is procedural, so it needs one deterministic set of cell offsets. */
export const STARFIELD_SEED: [number, number, number] = [20260922, 31415926, 27182818];

/**
 * Radiance of the galactic band in the sky: a fixed great circle, tilted away from the disc plane
 * so the band never lines up with the accretion disc.
 */
export const SKY_BAND_DIRECTION = normalize([0.28, 0.86, 0.42]);

function normalize(vector: [number, number, number]): [number, number, number] {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * Fragment shader for one disc geometry. Table dimensions come from the parsed LUT specs, and the
 * disc constants from the seeded geometry, exactly as the upstream shader manager injects them, so
 * the shader and the uploaded tables cannot disagree.
 */
export function fragmentSource(geometry: DiscGeometry): string {
  const [bandX, bandY, bandZ] = SKY_BAND_DIRECTION;
  return `#version 300 es
precision highp float;

// Copyright (c) 2020 Eric Bruneton, BSD-3-Clause: see public/vendor/licenses/blackhole-LICENSE.txt.

// Scene uniforms, as the upstream demo feeds them from its camera model. e_tau, e_w, e_h and e_d
// carry the spatial components of the camera frame vectors, which is what the model equations use.
uniform vec4 camera_position;
uniform vec3 p;
uniform vec4 k_s;
uniform vec3 e_tau, e_w, e_h, e_d;
uniform vec3 camera_size;
// The UV of the viewport the centre of the frame shows: (0.5, 0.5) is upstream's centred view.
uniform vec2 view_center;
uniform vec3 disc_params;
uniform float exposure;
uniform uvec3 star_seed;

uniform sampler2D ray_deflection_texture;
uniform sampler2D ray_inverse_radius_texture;
uniform sampler2D black_body_texture;
uniform highp sampler3D doppler_texture;
uniform sampler2D noise_texture;

in vec2 vUv;

layout(location = 0) out vec4 frag_color;

// Compile-time header, as the upstream shader manager builds it. LENSING, DOPPLER, GRID and STARS
// are fixed here: real table lookups and Doppler on, the debug grid and the star cube maps off.
#define IN(x) const in x
#define OUT(x) out x
#define LENSING 1
#define DOPPLER 1
#define GRID 0
#define STARS 0
#define SKY_OCTAVES 3

const float pi = 3.141592653589793;
const float rad = 1.0;
const int RAY_DEFLECTION_TEXTURE_WIDTH = ${LUTS.deflection.width};
const int RAY_DEFLECTION_TEXTURE_HEIGHT = ${LUTS.deflection.height};
const int RAY_INVERSE_RADIUS_TEXTURE_WIDTH = ${LUTS.inverseRadius.width};
const int RAY_INVERSE_RADIUS_TEXTURE_HEIGHT = ${LUTS.inverseRadius.height};

${discParameterSource(geometry)}

// ============================== black_hole/definitions.glsl ==============================
// Angles and dimensionless quantities.
#define Angle float
#define Real float
// An angle and a time (in the 1st and 2nd components, respectively).
#define TimedAngle vec2
// An inverse distance and a time (in the 1st and 2nd components, respectively).
#define TimedInverseDistance vec2
// A 2D texture with TimedAngle values.
#define RayDeflectionTexture sampler2D
// A 2D texture with TimedInverseDistance values.
#define RayInverseRadiusTexture sampler2D

// ============================== black_hole/functions.glsl ================================
const Real kMu = 4.0 / 27.0;

Real GetRayDeflectionTextureUFromEsquare(const Real e_square) {
  if (e_square < kMu) {
    return 0.5 - sqrt(-log(1.0 - e_square / kMu) * (1.0 / 50.0));
  } else {
    return 0.5 + sqrt(-log(1.0 - kMu / e_square) * (1.0 / 50.0));
  }
}

Real GetUapsisFromEsquare(const Real e_square) {
  Real x = (2.0 / kMu) * e_square - 1.0;
  return 1.0 / 3.0 + (2.0 / 3.0) * sin(asin(x) * (1.0 / 3.0));
}

Real GetRayDeflectionTextureVFromEsquareAndU(const Real e_square,
                                             const Real u) {
  if (e_square > kMu) {
    Real x = u < 2.0 / 3.0 ? -sqrt(2.0 / 3.0 - u) : sqrt(u - 2.0 / 3.0);
    return (sqrt(2.0 / 3.0) + x) / (sqrt(2.0 / 3.0) + sqrt(1.0 / 3.0));
  } else {
    return 1.0 - sqrt(max(1.0 - u / GetUapsisFromEsquare(e_square), 0.0));
  }
}

Real GetTextureCoordFromUnitRange(const Real x, const int texture_size) {
  return 0.5 / Real(texture_size) + x * (1.0 - 1.0 / Real(texture_size));
}

TimedAngle LookupRayDeflection(IN(RayDeflectionTexture) ray_deflection_texture,
                               const Real e_square, const Real u,
                               OUT(TimedAngle) deflection_apsis) {
  Real tex_u = GetTextureCoordFromUnitRange(
      GetRayDeflectionTextureUFromEsquare(e_square),
      RAY_DEFLECTION_TEXTURE_WIDTH);
  Real tex_v = GetTextureCoordFromUnitRange(
      GetRayDeflectionTextureVFromEsquareAndU(e_square, u),
      RAY_DEFLECTION_TEXTURE_HEIGHT);
  Real tex_v_apsis =
      GetTextureCoordFromUnitRange(1.0, RAY_DEFLECTION_TEXTURE_HEIGHT);
  deflection_apsis =
      TimedAngle(texture(ray_deflection_texture, vec2(tex_u, tex_v_apsis)));
  return TimedAngle(texture(ray_deflection_texture, vec2(tex_u, tex_v)));
}

Angle GetPhiUbFromEsquare(const Real e_square) {
  return (1.0 + e_square) / (1.0 / 3.0 + 2.0 * e_square * sqrt(e_square)) * rad;
}

Real GetRayInverseRadiusTextureUFromEsquare(const Real e_square) {
  return 1.0 / (1.0 + 6.0 * e_square);
}

TimedInverseDistance LookupRayInverseRadius(IN(RayInverseRadiusTexture)
                                                ray_inverse_radius_texture,
                                            const Real e_square,
                                            const Angle phi) {
  Real tex_u = GetTextureCoordFromUnitRange(
      GetRayInverseRadiusTextureUFromEsquare(e_square),
      RAY_INVERSE_RADIUS_TEXTURE_WIDTH);
  Real tex_v = GetTextureCoordFromUnitRange(phi / GetPhiUbFromEsquare(e_square),
                                            RAY_INVERSE_RADIUS_TEXTURE_HEIGHT);
  return TimedInverseDistance(
      texture(ray_inverse_radius_texture, vec2(tex_u, tex_v)));
}

// Anti-aliased pulse function. See
// https://renderman.pixar.com/resources/RenderMan_20/basicAntialiasing.html.
Real FilteredPulse(Real edge0, Real edge1, Real x, Real fw) {
  fw = max(fw, 1e-6);
  Real x0 = x - fw * 0.5;
  Real x1 = x0 + fw;
  return max(0.0, (min(x1, edge1) - max(x0, edge0)) / fw);
}

Angle TraceRay(IN(RayDeflectionTexture) ray_deflection_texture,
               IN(RayInverseRadiusTexture) ray_inverse_radius_texture,
               const Real u, const Real u_dot, const Real e_square,
               const Angle delta, const Angle alpha, const Real u_ic,
               const Real u_oc, OUT(Real) u0, OUT(Angle) phi0, OUT(Real) t0,
               OUT(Real) alpha0, OUT(Real) u1, OUT(Angle) phi1, OUT(Real) t1,
               OUT(Real) alpha1) {
  // Compute the ray deflection.
  u0 = -1.0;
  u1 = -1.0;
  if (e_square < kMu && u > 2.0 / 3.0) {
    return -1.0 * rad;
  }
  TimedAngle deflection_apsis;
  TimedAngle deflection = LookupRayDeflection(ray_deflection_texture, e_square,
                                              u, deflection_apsis);
  Angle ray_deflection = deflection.x;
  if (u_dot > 0.0) {
    ray_deflection =
        e_square < kMu ? 2.0 * deflection_apsis.x - ray_deflection : -1.0 * rad;
  }
  // Compute the accretion disc intersections.
  Real s = sign(u_dot);
  Angle phi = deflection.x + (s == 1.0 ? pi - delta : delta) + s * alpha;
  Angle phi_apsis = deflection_apsis.x + pi / 2.0;
  phi0 = mod(phi, pi);
  TimedInverseDistance ui0 =
      LookupRayInverseRadius(ray_inverse_radius_texture, e_square, phi0);
  if (phi0 < phi_apsis) {
    Real side = s * (ui0.x - u);
    if (side > 1e-3 || (side > -1e-3 && alpha < delta)) {
      u0 = ui0.x;
      phi0 = alpha + phi - phi0;
      t0 = s * (ui0.y - deflection.y);
    }
  }
  phi = 2.0 * phi_apsis - phi;
  phi1 = mod(phi, pi);
  TimedInverseDistance ui1 =
      LookupRayInverseRadius(ray_inverse_radius_texture, e_square, phi1);
  if (e_square < kMu && s == 1.0 && phi1 < phi_apsis) {
    u1 = ui1.x;
    phi1 = alpha + phi - phi1;
    t1 = 2.0 * deflection_apsis.y - ui1.y - deflection.y;
  }
  // Compute the anti-aliasing opacity values.
  Real fw0 = min(fwidth(ui0.x), fwidth(u0 == -1.0 ? u1 : u0));
  Real fw1 = min(fwidth(ui1.x), fwidth(u1 == -1.0 ? u0 : u1));
  alpha0 = FilteredPulse(u_oc, u_ic, u0, fw0);
  alpha1 = FilteredPulse(u_oc, u_ic, u1, fw1);
  if (s == 1.0 && abs(e_square - kMu) < min(fwidth(e_square), kMu)) {
    if (alpha0 < 0.99) u0 = 2.0 / (1.0 / u_ic + 1.0 / u_oc);
    if (alpha1 < 0.99) u1 = 2.0 / (1.0 / u_ic + 1.0 / u_oc);
  }
  return ray_deflection;
}

Angle TraceRay(IN(RayDeflectionTexture) ray_deflection_texture,
               IN(RayInverseRadiusTexture) ray_inverse_radius_texture,
               const Real p_r, const Angle delta, const Angle alpha,
               const Real u_ic, const Real u_oc, OUT(Real) u0,
               OUT(Angle) phi0, OUT(Real) t0, OUT(Real) alpha0, OUT(Real) u1,
               OUT(Angle) phi1, OUT(Real) t1, OUT(Real) alpha1) {
  Real u = 1.0 / p_r;
  Real u_dot = -u / tan(delta);
  Real e_square = u_dot * u_dot + u * u * (1.0 - u);
  return TraceRay(ray_deflection_texture, ray_inverse_radius_texture, u,
                  u_dot, e_square, delta, alpha, u_ic, u_oc, u0, phi0, t0,
                  alpha0, u1, phi1, t1, alpha1);
}

// ============================== black_hole/model.glsl ====================================
// The functions this shader has to provide. Upstream lists them in a comment and relies on the
// order of the assembled files; here the list is real declarations, because the scene-provided
// definitions follow SceneColor in this single source.
Angle RayTrace(Real u, Real u_dot, Real e_square, Angle delta, Angle alpha,
               Real u_ic, Real u_oc, out Real u0, out Angle phi0, out Real t0,
               out Real alpha0, out Real u1, out Angle phi1, out Real t1,
               out Real alpha1);
vec3 Doppler(vec3 rgb, float doppler_factor);
vec3 GalaxyColor(vec3 dir);
vec3 StarColor(vec3 dir, float lensing_amplification_factor);
float Noise(vec2 uv);
vec4 DiscColor(vec2 p, float t, bool top_side, float doppler_factor);

vec3 DefaultDoppler(highp sampler3D doppler_texture, vec3 rgb,
                    float doppler_factor) {
  float sum = rgb.r + rgb.g + rgb.b;
  if (sum == 0.0) {
    return vec3(0.0);
  }
  vec3 tex_coord;
  tex_coord.x = rgb.r / sum;
  tex_coord.y = 2.0 * rgb.g / sum;
  tex_coord.z = (1.0 / 3.0) * atan((1.0 / 0.21) * log(doppler_factor)) + 0.5;
  return sum * texture(doppler_texture, tex_coord).rgb;
}

vec3 BlackBodyColor(sampler2D black_body_texture, float temperature) {
  float tex_u = (1.0 / 6.0) * log(temperature * (1.0 / 100.0));
  return texture(black_body_texture, vec2(tex_u, 0.5)).rgb;
}

vec4 DefaultDiscColor(vec2 p, float p_t, bool top_side, float doppler_factor,
                      float disc_temperature, sampler2D black_body_texture) {
  float p_r = length(p);
  float p_phi = atan(p.y, p.x);

  float density = 0.0;
  for (int i = 0; i < NUM_DISC_PARTICLES; ++i) {
    vec4 params = DISC_PARTICLE_PARAMS[i];
    float u1 = params.x;
    float u2 = params.y;
    float phi0 = params.z;
    float dtheta_dphi = params.w;
    float u_avg = (u1 + u2) * 0.5;
    float dphi_dt = u_avg * sqrt(0.5 * u_avg);
    float phi = dphi_dt * p_t + phi0;
    float a = mod(p_phi - phi, 2.0 * pi);
    float s = sin(dtheta_dphi * (a + phi));
    float r = 1.0 / (u1 + (u2 - u1) * s * s);
    vec2 d = vec2(a - pi, r - p_r) * vec2(1.0 / pi, 0.5);
    float noise = Noise(d * vec2(p_r / OUTER_DISC_R, 1.0));
    density += smoothstep(1.0, 0.0, length(d)) * noise;
  }

  const float r_max = 49.0 / 12.0;
  const float temperature_profile_max =
      pow((1.0 - sqrt(3.0 / r_max)) / (r_max * r_max * r_max), 0.25);
  float temperature_profile =
      pow((1.0 - sqrt(3.0 / p_r)) / (p_r * p_r * p_r), 0.25);
  float temperature =
      disc_temperature * temperature_profile * (1.0 / temperature_profile_max);

  vec3 color = max(density, 0.0) *
      BlackBodyColor(black_body_texture, temperature * doppler_factor);
  float alpha = smoothstep(INNER_DISC_R, INNER_DISC_R * 1.2, p_r) *
      smoothstep(OUTER_DISC_R, OUTER_DISC_R / 1.2, p_r);
  return vec4(color * alpha, alpha);
}

vec3 SceneColor(vec4 camera_position, vec3 p, vec4 k_s, vec3 e_tau, vec3 e_w,
                vec3 e_h, vec3 e_d, vec3 view_dir) {
  vec3 q = normalize(view_dir);
  vec3 d = -e_tau + q.x * e_w + q.y * e_h + q.z * e_d;

  vec3 e_x_prime = normalize(p);
  vec3 e_z_prime = normalize(cross(e_x_prime, d));
  vec3 e_y_prime = normalize(cross(e_z_prime, e_x_prime));

  const vec3 e_z = vec3(0.0, 0.0, 1.0);
  vec3 t = normalize(cross(e_z, e_z_prime));
  if (dot(t, e_y_prime) < 0.0) {
    t = -t;
  }

  float alpha = acos(clamp(dot(e_x_prime, t), -1.0, 1.0));
  float delta = acos(clamp(dot(e_x_prime, normalize(d)), -1.0, 1.0));

  float u = 1.0 / camera_position[1];
  float u_dot = -u / tan(delta);
  float e_square = u_dot * u_dot + u * u * (1.0 - u);
  float e = -sqrt(e_square);

  const float U_IC = 1.0 / INNER_DISC_R;
  const float U_OC = 1.0 / OUTER_DISC_R;
  float u0, phi0, t0, alpha0, u1, phi1, t1, alpha1;
  float deflection = RayTrace(u, u_dot, e_square, delta, alpha, U_IC, U_OC,
                              u0, phi0, t0, alpha0, u1, phi1, t1, alpha1);

  vec4 l = vec4(e / (1.0 - u), -u_dot, 0.0, u * u);
  float g_k_l_receiver = k_s.x * l.x * (1.0 - u) - k_s.y * l.y / (1.0 - u) -
                         u * dot(e_tau, e_y_prime) * l.w / (u * u);

  float delta_prime = delta + max(deflection, 0.0);
  vec3 d_prime = cos(delta_prime) * e_x_prime + sin(delta_prime) * e_y_prime;

  vec3 color = vec3(0.0, 0.0, 0.0);
  if (deflection >= 0.0) {
    float g_k_l_source = e;
    float doppler_factor = g_k_l_receiver / g_k_l_source;

    // The solid angle (times 4pi) of the pixel.
    float omega = length(cross(dFdx(q), dFdy(q)));
    // The solid angle (times 4pi) of the deflected light beam.
    float omega_prime = length(cross(dFdx(d_prime), dFdy(d_prime)));

    float lensing_amplification_factor = omega / omega_prime;
    // Clamp the result (otherwise potentially infinite).
    lensing_amplification_factor = min(lensing_amplification_factor, 1e6);

    // The galaxy texture contains the radiant intensity of stars, per unit area
    // on the celestial sphere, i.e. radiance values (using omega0 as area unit,
    // with omega0 = 4pi * the solid angle of the center texel of a cube face).
    // The stars texture contains radiant intensities. To convert the total
    // intensity inside a pixel to a radiance, this intensity must be divided by
    // the pixel area on the celestial sphere. Expressed in the units used for
    // the galaxy texture, this area is omega / omega0 (where, since the galaxy
    // texture is a 2048x2048 cubemap, omega0 is 1 / 1024^2).
    float pixel_area = max(omega * (1024.0 * 1024.0), 1.0);

    color += GalaxyColor(d_prime);
    color += StarColor(d_prime, lensing_amplification_factor / pixel_area);
    color = Doppler(color, doppler_factor);
  }
  if (u1 >= 0.0 && alpha1 > 0.0) {
    float g_k_l_source = e * sqrt(2.0 / (2.0 - 3.0 * u1)) -
                         u1 * sqrt(u1 / (2.0 - 3.0 * u1)) * dot(e_z, e_z_prime);
    float doppler_factor = g_k_l_receiver / g_k_l_source;
    bool top_side =
        (mod(abs(phi1 - alpha), 2.0 * pi) < 1e-3) == (e_x_prime.z > 0.0);

    vec3 i1 = (e_x_prime * cos(phi1) + e_y_prime * sin(phi1)) / u1;
    vec4 disc_color =
        DiscColor(i1.xy, camera_position[0] - t1, top_side, doppler_factor);
    color = color * (1.0 - disc_color.a) + alpha1 * disc_color.rgb;
  }
  if (u0 >= 0.0 && alpha0 > 0.0) {
    float g_k_l_source = e * sqrt(2.0 / (2.0 - 3.0 * u0)) -
                         u0 * sqrt(u0 / (2.0 - 3.0 * u0)) * dot(e_z, e_z_prime);
    float doppler_factor = g_k_l_receiver / g_k_l_source;
    bool top_side =
        (mod(abs(phi0 - alpha), 2.0 * pi) < 1e-3) == (e_x_prime.z > 0.0);

    vec3 i0 = (e_x_prime * cos(phi0) + e_y_prime * sin(phi0)) / u0;
    vec4 disc_color =
        DiscColor(i0.xy, camera_position[0] - t0, top_side, doppler_factor);
    color = color * (1.0 - disc_color.a) + alpha0 * disc_color.rgb;
  }
  return color;
}

// ============================== Procedural sky ==========================================
// GalaxyColor normally samples a 2048^2 RGB9_E5 cube map of the Gaia sky survey (516 tiles, about
// 256 MB) and StarColor filters the Tycho-2 star cube map; neither ships here. The extended sky is
// a deterministic procedural field instead: integer hash points on the sphere for the stars, a
// low-brightness value-noise nebula, and a soft galactic band. The radiance constants are chosen so
// that after the output stage the dust reads well below the disc while a few star cores reach white.

const vec3 SKY_DUST_COLOR = vec3(0.42, 0.53, 0.78);
const vec3 SKY_BAND_COLOR = vec3(0.72, 0.62, 0.48);
const vec3 SKY_BAND_NORMAL = vec3(${bandX.toFixed(5)}, ${bandY.toFixed(5)}, ${bandZ.toFixed(5)});
const float SKY_BAND_FALLOFF = 9.0;
const float SKY_NEBULA_SCALE = 2.6;
const float SKY_AMBIENT = 0.9;

// A 32-bit cell hash: integer mixing only, so there is no trig and no time input and every ES 3.0
// driver returns the same field.
float CellHash(uvec3 cell) {
  uint h = cell.x * 0x9E3779B1u ^ cell.y * 0x85EBCA77u ^ cell.z * 0xC2B2AE3Du;
  h ^= h >> 15;
  h *= 0x2545F491u;
  h ^= h >> 13;
  h *= 0x27220A95u;
  h ^= h >> 16;
  return float(h >> 8) * (1.0 / 16777216.0);
}

// Three decorrelated draws from one cell: the point offset and the magnitude.
vec3 CellHash3(uvec3 cell) {
  return vec3(
      CellHash(cell),
      CellHash(cell + uvec3(0x9E3779B1u, 0x85EBCA77u, 0xC2B2AE3Du)),
      CellHash(cell + uvec3(0x2545F491u, 0x27220A95u, 0x165667B1u)));
}

// Cell coordinates shifted into the positive range the integer hash expects, and salted by the
// fixed seed.
uvec3 SkyCell(ivec3 cell) {
  return uvec3(cell + 4096) + star_seed;
}

// Major-axis cube projection: face coordinates in [-1,1] plus a face index that keeps the six
// lattices apart. A latitude/longitude grid would pinch at the poles; a cube face does not.
vec2 CubeFace(vec3 dir, out uint face) {
  vec3 a = abs(dir);
  if (a.x >= a.y && a.x >= a.z) {
    face = dir.x > 0.0 ? 0u : 1u;
    return vec2(dir.z, dir.y) / a.x;
  }
  if (a.y >= a.z) {
    face = dir.y > 0.0 ? 2u : 3u;
    return vec2(dir.x, dir.z) / a.y;
  }
  face = dir.z > 0.0 ? 4u : 5u;
  return vec2(dir.x, dir.y) / a.z;
}

// Trilinear value noise over the direction, used by the nebula only.
float SkyNoise(vec3 point) {
  vec3 base = floor(point);
  vec3 t = point - base;
  uvec3 cell = SkyCell(ivec3(base));
  float n000 = CellHash(cell);
  float n100 = CellHash(cell + uvec3(1u, 0u, 0u));
  float n010 = CellHash(cell + uvec3(0u, 1u, 0u));
  float n110 = CellHash(cell + uvec3(1u, 1u, 0u));
  float n001 = CellHash(cell + uvec3(0u, 0u, 1u));
  float n101 = CellHash(cell + uvec3(1u, 0u, 1u));
  float n011 = CellHash(cell + uvec3(0u, 1u, 1u));
  float n111 = CellHash(cell + uvec3(1u, 1u, 1u));
  vec3 s = t * t * (3.0 - 2.0 * t);
  return mix(
      mix(mix(n000, n100, s.x), mix(n010, n110, s.x), s.y),
      mix(mix(n001, n101, s.x), mix(n011, n111, s.x), s.y),
      s.z);
}

float SkyFbm(vec3 point) {
  float sum = 0.0;
  float amplitude = 0.5;
  float norm = 0.0;
  for (int i = 0; i < SKY_OCTAVES; ++i) {
    sum += amplitude * SkyNoise(point);
    norm += amplitude;
    point = point * 2.03 + vec3(11.3, 7.7, 19.1);
    amplitude *= 0.5;
  }
  return sum / norm;
}

// One layer of hash stars. The point sits in the middle 60% of its cell and the kernel dies out
// inside the cell, so no star is clipped by a cell or a face border.
vec3 StarLayer(vec2 faceUv, uint face, float cells, float size, float gain, uvec3 salt) {
  vec2 grid = faceUv * cells;
  vec2 cell = floor(grid);
  // The cell is 2D: the missing component is filled with 0, and the face stays in the salt term.
  vec3 h = CellHash3(SkyCell(ivec3(ivec2(cell), 0)) + uvec3(face) + salt);
  vec2 point = cell + 0.2 + 0.6 * h.xy;
  // A power law on the magnitude keeps most stars faint and a few bright.
  float magnitude = pow(h.z, 5.0);
  float core = 1.0 - smoothstep(0.0, size, length(grid - point));
  // Near-neutral tints: the Doppler table only holds valid entries around the neutral chromaticity.
  vec3 tint = mix(vec3(0.82, 0.93, 1.12), vec3(1.14, 1.0, 0.86), fract(h.z * 61.7));
  return tint * (gain * magnitude * core * core);
}

vec3 GalaxyColor(vec3 dir) {
  vec3 d = normalize(dir);
  uint face;
  vec2 faceUv = CubeFace(d, face);
  float along = dot(d, SKY_BAND_NORMAL);
  float band = exp(-SKY_BAND_FALLOFF * along * along);
  float dust = smoothstep(0.46, 0.86, SkyFbm(d * SKY_NEBULA_SCALE) + 0.3 * band);
  vec3 color = SKY_DUST_COLOR * (10.0 * dust * dust);
  color += SKY_BAND_COLOR * (9.0 * band * dust);
  color += SKY_DUST_COLOR * SKY_AMBIENT;
  float crowding = 1.0 + 0.7 * band;
  color += StarLayer(faceUv, face, 42.0, 0.10, 34.0, uvec3(0u)) * crowding;
  color += StarLayer(faceUv, face, 86.0, 0.11, 90.0, uvec3(17u, 29u, 43u)) * crowding;
  color += StarLayer(faceUv, face, 21.0, 0.09, 420.0, uvec3(97u, 71u, 53u)) * crowding;
  return color;
}

// STARS 0: the punctual-source branch (the Tycho-2 star cube map) stays off.
vec3 StarColor(vec3 dir, float lensing_amplification_factor) {
  return vec3(0.0);
}

// Disc density noise: the upstream 8-bit repeat texture, mapped from [0,1] to [-0.5, 2.5].
float Noise(vec2 uv) {
  return 3.0 * (texture(noise_texture, uv).r - 0.5) + 1.0;
}

// ============================== Scene glue ==============================================
// LENSING is fixed at 1, so the flat-space TraceRayEuclidean fallback of the demo is not compiled.
float RayTrace(float u, float u_dot, float e_square, float delta, float alpha,
               float u_ic, float u_oc, out float u0, out float phi0, out float t0,
               out float alpha0, out float u1, out float phi1, out float t1,
               out float alpha1) {
  return TraceRay(ray_deflection_texture, ray_inverse_radius_texture, u, u_dot,
                  e_square, delta, alpha, u_ic, u_oc, u0, phi0, t0, alpha0, u1,
                  phi1, t1, alpha1);
}

vec3 Doppler(vec3 rgb, float doppler_factor) {
  return DefaultDoppler(doppler_texture, rgb, doppler_factor);
}

// DOPPLER is fixed at 1 and GRID at 0, so the disc is the default shading and the Doppler factor
// is never forced back to 1.
vec4 DiscColor(vec2 p, float t, bool top_side, float doppler_factor) {
  float density = disc_params.x;
  float opacity = disc_params.y;
  float temperature = disc_params.z;
  vec4 color = DefaultDiscColor(p, t, top_side, doppler_factor, temperature, black_body_texture);
  return vec4(density * color.rgb, opacity * color.a);
}

// ============================== Output stage ============================================
// The upstream demo renders the HDR scene into a float buffer, adds a multi-level bloom and tone
// maps in a second pass. This scene tone maps in the same fragment instead: the HDR scene colour is
// unchanged, but no float render target, no bloom and no float blending are needed.
//
// ACES filmic curve, as in the upstream render pass, after
// https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/ .
vec3 ToneMapACES(vec3 color) {
  const float A = 2.51;
  const float B = 0.03;
  const float C = 2.43;
  const float D = 0.59;
  const float E = 0.14;
  // The clamp is this scene's one addition to the upstream curve: upstream feeds it a colour that
  // is already non-negative, while a disc density below zero can hand pow() a negative base here.
  color = clamp((color * (A * color + B)) / (color * (C * color + D) + E), 0.0, 1.0);
  return pow(color, vec3(1.0 / 2.2));
}

void main() {
  // The upstream vertex shader derives the view direction from the quad corner, centred on the
  // frame; vUv covers the viewport and is linear in clip space, so the same expression is exact
  // here. view_center moves the point the frame is centred on, which is this scene's framing.
  vec3 view_dir = vec3((vUv - view_center) * 2.0 * camera_size.xy, -camera_size.z);
  vec3 color = SceneColor(camera_position, p, k_s, e_tau, e_w, e_h, e_d, view_dir);
  frag_color = vec4(ToneMapACES(min(color * exposure, vec3(10.0))), 1.0);
}
`;
}
