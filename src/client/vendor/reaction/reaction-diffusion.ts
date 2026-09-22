/**
 * Gray–Scott reaction-diffusion shaders from piellardj/reaction-diffusion-webgl, commit
 * `be78fc4e6c02ea8ccc573407f37ca3a3477b9b57` (MIT, Jérémie Piellard). The full license ships at
 * `public/vendor/licenses/reaction-LICENSE.txt`; every local change is listed in `README.md`.
 *
 * The 3×3 Laplacian, the two coupled equations and the 16-bit-in-RGBA8 packing are upstream code.
 * Only the WebGL2 entry points around them are local: GLSL ES 3.00 syntax, the shared fullscreen
 * triangle instead of upstream's quad vertex shader, and the removal of the `#include` step.
 */

/** Storage of one concentration pair: A in `.rg`, B in `.ba`, so no float texture is needed. */
export const ENCODE_DECODE_GLSL = `
// Decodes a float value (16 bits in [0,1])
// from a 2D value (2x8bits in [0,1]x[0,1])
float decode16bit(vec2 v) {
  return dot(v, vec2(255.0 / 256.0, 1.0 / 256.0));
}

// Encodes a float value (16 bits in [0,1])
// into a 2D value (2x8bits in [0,1]x[0,1])
vec2 encode16bit(float f) {
  f = 255.99 * clamp(f, 0.0, 1.0);
  return vec2(floor(f) / 255.0, fract(f));
}

vec2 decode(vec4 encoded) {
  return vec2(decode16bit(encoded.rg), decode16bit(encoded.ba));
}

vec4 encode(vec2 decoded) {
  return vec4(encode16bit(decoded.x), encode16bit(decoded.y));
}
`;

/**
 * Solves one Gray–Scott step in `uRates` order (feed, kill, diffuse A, diffuse B) and writes the
 * packed result. `highp` is not cosmetic here: `mediump` would drop the low byte of the packing on
 * devices that really use 16-bit floats.
 */
export const REACTION_UPDATE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPreviousIteration;
uniform vec2 uTexelSize;
// x: feed A rate, y: kill B rate, z: diffuse A rate, w: diffuse B rate
uniform vec4 uRates;

in vec2 vUv;
out vec4 fragColor;

${ENCODE_DECODE_GLSL}

vec2 kernel(vec2 decodedCenter) {
  return
    decode(texture(uPreviousIteration, vUv + vec2(-1, -1) * uTexelSize)) * 0.05 +
    decode(texture(uPreviousIteration, vUv + vec2(+0, -1) * uTexelSize)) * 0.20 +
    decode(texture(uPreviousIteration, vUv + vec2(+1, -1) * uTexelSize)) * 0.05 +

    decode(texture(uPreviousIteration, vUv + vec2(-1, +0) * uTexelSize)) * 0.20 -
    decodedCenter +
    decode(texture(uPreviousIteration, vUv + vec2(+1, +0) * uTexelSize)) * 0.20 +

    decode(texture(uPreviousIteration, vUv + vec2(-1, +1) * uTexelSize)) * 0.05 +
    decode(texture(uPreviousIteration, vUv + vec2(+0, +1) * uTexelSize)) * 0.20 +
    decode(texture(uPreviousIteration, vUv + vec2(+1, +1) * uTexelSize)) * 0.05;
}

vec4 computeNewValue(const float feedA, const float killB, const float diffuseA, const float diffuseB) {
  vec2 values = decode(texture(uPreviousIteration, vUv));
  vec2 laplace = kernel(values);

  float A = values.x;
  float B = values.y;
  float reaction = A * B * B;
  const float dt = 1.0;
  values = vec2(
    values.x + dt * (diffuseA * laplace.x - reaction + feedA * (1.0 - A)),
    values.y + dt * (diffuseB * laplace.y + reaction - (killB + feedA) * B)
  );

  return encode(values);
}

void main() {
  fragColor = computeNewValue(uRates.x, uRates.y, uRates.z, uRates.w);
}
`;

/**
 * The pointer disturbance: upstream `update/brush-apply.frag` writes `vec2(1)` inside the brush and
 * discards the rest. The circle is measured in simulation coordinates instead of in the quad that
 * upstream positions with a dedicated vertex shader, so the shared fullscreen triangle can draw it.
 */
export const REACTION_BRUSH_FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform float uRadius;

in vec2 vUv;
out vec4 fragColor;

${ENCODE_DECODE_GLSL}

void main() {
  if (distance(vUv, uCenter) > uRadius) {
    discard;
  }

  fragColor = encode(vec2(1.0));
}
`;
