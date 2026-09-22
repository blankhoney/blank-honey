/**
 * Display pass for the reaction hero — local authorship, no upstream shader and no colour texture.
 *
 * It reads the packed simulation state, interpolates *decoded* values (interpolating the packed
 * bytes themselves would decode to noise), and turns chemical B into a cyan-green colony with gold
 * crests, lit by the gradient of the field and shaded by a coarse neighbourhood so the texture
 * reads as coral cells instead of flat blobs. The colours and the two knobs below are starting
 * values for those look parameters, not measured optima.
 */

import { ENCODE_DECODE_GLSL } from '../../vendor/reaction/reaction-diffusion';

/** Relief strength of the gradient lighting. */
export const DISPLAY_RELIEF = 3.2;
/** How quickly the pattern fronts turn gold: high enough to keep the rims visible at a glance. */
export const DISPLAY_CREST = 9;

export const REACTION_DISPLAY_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uState;
uniform vec2 uTexelSize;  // 1 / simulation grid size
uniform vec2 uRegion;     // fraction of the grid shown, from sampledRegion()
uniform float uRelief;
uniform float uCrest;

in vec2 vUv;
out vec4 fragColor;

${ENCODE_DECODE_GLSL}

// Substrate, colony body and crest: a near-black teal that keeps the hero text readable over it.
const vec3 SUBSTRATE = vec3(0.012, 0.052, 0.062);
const vec3 COLONY = vec3(0.075, 0.478, 0.412);
const vec3 GOLD = vec3(0.914, 0.722, 0.310);
// Low-frequency shading samples this many cells away.
const float COARSE_STRIDE = 6.0;

vec2 sampleState(vec2 texel) {
  // NEAREST sampling at texel centres: only there does the packing decode to a real concentration.
  return decode(texture(uState, (texel + 0.5) * uTexelSize));
}

void main() {
  vec2 uv = clamp((vUv - 0.5) * uRegion + 0.5, vec2(0.0), vec2(1.0));
  vec2 position = uv / uTexelSize - 0.5;
  vec2 base = floor(position);
  vec2 blend = position - base;

  vec2 corner00 = sampleState(base);
  vec2 corner10 = sampleState(base + vec2(1.0, 0.0));
  vec2 corner01 = sampleState(base + vec2(0.0, 1.0));
  vec2 corner11 = sampleState(base + vec2(1.0, 1.0));

  float colony = mix(
    mix(corner00.y, corner10.y, blend.x),
    mix(corner01.y, corner11.y, blend.x),
    blend.y
  );
  vec2 gradient = vec2(
    mix(corner10.y - corner00.y, corner11.y - corner01.y, blend.y),
    mix(corner01.y - corner00.y, corner11.y - corner10.y, blend.x)
  );

  // Coarse field: colonies that sit in dense growth are shaded down, which gives the low-frequency
  // shadow between cells.
  float coarse = 0.25 * (
    sampleState(base + vec2(COARSE_STRIDE, 0.0)).y +
    sampleState(base - vec2(COARSE_STRIDE, 0.0)).y +
    sampleState(base + vec2(0.0, COARSE_STRIDE)).y +
    sampleState(base - vec2(0.0, COARSE_STRIDE)).y
  );

  vec3 normal = normalize(vec3(-gradient.x * uRelief, -gradient.y * uRelief, 1.0));
  float lambert = clamp(dot(normal, normalize(vec3(-0.35, 0.55, 0.76))), 0.0, 1.0);
  float occlusion = mix(0.55, 1.0, smoothstep(0.02, 0.45, coarse));
  float crest = clamp(length(gradient) * uCrest, 0.0, 1.0);

  vec3 color = mix(SUBSTRATE, COLONY, smoothstep(0.02, 0.30, colony));
  color = mix(color, GOLD, crest * smoothstep(0.04, 0.40, colony));
  color *= mix(0.78, 1.08, lambert) * occlusion;

  fragColor = vec4(color, 1.0);
}
`;
