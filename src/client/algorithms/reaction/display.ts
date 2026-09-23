/**
 * Display pass for the reaction hero — local authorship, no upstream shader and no colour texture.
 *
 * It reads the packed simulation state, interpolates *decoded* values (interpolating the packed
 * bytes themselves would decode to noise), and prints the colony as a field of shallow hollows in a
 * high-key limestone plate, lit by the slope of the relief. Two steps frame it: the base window
 * `uRegion` crops the square grid to the canvas aspect, then a conformal exponential lens magnifies
 * the far side of the plate without shearing it, so the pattern opens out towards the right of a
 * wide stage instead of looking like a tiled sheet. The raster is bounded on purpose: four corners
 * for the decoded field plus a four-tap coarse neighbourhood for the local occlusion, no ray loop
 * and no extra render target. The two knobs below, the two lens constants in `view.ts` and the four
 * palette constants are look values, not measured optima.
 */

import { ENCODE_DECODE_GLSL } from '../../vendor/reaction/reaction-diffusion';
import { REACTION_VIEW_SCALE, REACTION_VIEW_WARP } from './view';

/** Relief strength: how far the height gradient tilts the surface normal. */
export const DISPLAY_RELIEF = 6;
/** Slope gain that puts a pale stone lip on the sunward wall of a hollow. */
export const DISPLAY_CREST = 2;

/** Formats a number as a GLSL float literal, so a whole-number constant cannot reach the shader. */
function glslFloat(value: number): string {
  const text = String(value);
  return /[.eE]/.test(text) ? text : `${text}.0`;
}

export const REACTION_DISPLAY_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uState;
uniform vec2 uTexelSize;  // 1 / simulation grid size
uniform vec2 uRegion;     // fraction of the grid shown, from sampledRegion()
uniform float uAspect;    // drawing-buffer width / height, which picks the screen framing
uniform float uRelief;
uniform float uCrest;

in vec2 vUv;
out vec4 fragColor;

${ENCODE_DECODE_GLSL}

// Warm-white paper, grey-green hollow, limestone plate, pale warm lip: a high-key relief print rather
// than a coloured signal. The plate is the one value the hero copy can sit on without a dark scrim.
const vec3 SUBSTRATE = vec3(0.94, 0.925, 0.89);
const vec3 GROOVE = vec3(0.72, 0.75, 0.69);
const vec3 COLONY = vec3(0.92, 0.90, 0.84);
const vec3 CREST = vec3(0.99, 0.97, 0.90);
// The conformal view, injected from view.ts so the pointer and the display cannot drift apart.
const float VIEW_WARP = ${glslFloat(REACTION_VIEW_WARP)};
const float VIEW_SCALE = ${glslFloat(REACTION_VIEW_SCALE)};
// Local occlusion samples this many cells away: four fixed taps keep the pass bounded.
const float COARSE_STRIDE = 6.0;
// Fixed screen-space grain, two 8-bit steps peak to peak, and independent of time: the plate gets
// paper texture without the flicker a moving dither would add.
const float GRAIN = 2.0 / 255.0;

vec2 sampleState(vec2 texel) {
  // NEAREST sampling at texel centres: only there does the packing decode to a real concentration.
  return decode(texture(uState, (texel + 0.5) * uTexelSize));
}

/** Deterministic value noise in [0, 1): one screen pixel always gets the same grain. */
float grain(vec2 point) {
  return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // The base window first: q is the canvas position in the aspect-cropped square window, the same q
  // the pointer is mapped through. The lens is then the exponential map scale * (1 - exp(-warp*q)):
  // conformal, so a grid step keeps one length and one right angle per screen pixel while its scale
  // grows towards -qx — the pattern opens out instead of being stretched.
  vec2 q = (vUv - 0.5) * uRegion;
  float angle = VIEW_WARP * q.y;
  float magnitude = exp(-VIEW_WARP * q.x);
  vec2 uv = clamp(
    vec2(
      0.5 + VIEW_SCALE * (1.0 - magnitude * cos(angle)),
      0.5 + VIEW_SCALE * magnitude * sin(angle)
    ),
    vec2(0.0),
    vec2(1.0)
  );
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
  // The lens turns the field as well as scaling it, so the slope turns with it. Both components are
  // read at once: writing gradient.x before reading it would rotate against the new value.
  gradient = vec2(
    cos(angle) * gradient.x - sin(angle) * gradient.y,
    sin(angle) * gradient.x + cos(angle) * gradient.y
  );

  // Coarse field, four taps and no loop: isolated growth sits in a shallow depression and reads a
  // touch darker than the dense field, which is what separates neighbouring hollows of the relief.
  float coarse = 0.25 * (
    sampleState(base + vec2(COARSE_STRIDE, 0.0)).y +
    sampleState(base - vec2(COARSE_STRIDE, 0.0)).y +
    sampleState(base + vec2(0.0, COARSE_STRIDE)).y +
    sampleState(base - vec2(0.0, COARSE_STRIDE)).y
  );

  // The colony is the hollow and not a body: material is how deep the pattern has been let into the
  // plate, so the surface height is 1 - material and the plate is what the chemical leaves behind.
  float material = smoothstep(0.09, 0.25, colony);

  // Height is a function of the interpolated colony alone, so its slope follows the chain rule:
  // d(smoothstep)/d(colony) = 6t(1-t)/0.16 with t the normalised position inside the ramp, and the
  // sign flips because height = 1 - material. Analytic, so no second raster and no screen derivative.
  float t = clamp((colony - 0.09) / 0.16, 0.0, 1.0);
  vec2 heightGradient = -gradient * (6.0 * t * (1.0 - t) / 0.16);
  vec3 normal = normalize(vec3(-heightGradient.x * uRelief, -heightGradient.y * uRelief, 1.0));
  // One fixed soft key light from the upper left, and its half vector for the broad specular.
  vec3 lightDirection = normalize(vec3(-0.5, 0.7, 0.8));
  vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
  // High key: a hollow wall turned away from the key light keeps most of its value, so the plate
  // reads as pale stone rather than as a lit solid, and the wall only deepens by the last 30%.
  float lambert = 0.70 + 0.30 * max(dot(normal, lightDirection), 0.0);
  float specular = pow(max(dot(normal, halfVector), 0.0), 12.0) * 0.012;
  // A hollow whose surroundings are still bare stone is a little deeper than one inside the network.
  float occlusion = 1.0 - 0.12 * material * (1.0 - smoothstep(0.09, 0.25, coarse));
  // The lip of a hollow catches the light: the crest is a pale warm edge on the wall, so it is
  // weighted on its own rather than by the material it sits on.
  float crest = clamp(length(heightGradient) * uCrest, 0.0, 1.0);

  vec3 color = mix(COLONY, GROOVE, material);
  color = mix(color, CREST, crest * 0.10);
  color = color * (lambert * occlusion) + specular;

  // Screen framing: the relief keeps one side of the stage and the rest stays paper, with a soft
  // boundary so the hero copy never sits on a hard dark edge. A wide stage gives the relief the
  // right half behind a slow sine; a narrow one gives it the lower part below a straight soft step.
  float mask = uAspect >= 1.15
    ? smoothstep(0.34, 0.56, vUv.x + 0.055 * sin(vUv.y * 5.3))
    : 1.0 - smoothstep(0.46, 0.67, vUv.y);
  // vUv.y is 0 at the bottom of the canvas and 1 at the top. The navigation sits in the top 9% and
  // the switcher and entry link in the bottom 12%, and both need the bare plate under them, so the
  // relief is masked out there whatever the framing above decided.
  mask *= smoothstep(0.12, 0.23, vUv.y) * (1.0 - smoothstep(0.82, 0.91, vUv.y));
  color = mix(SUBSTRATE, color, mask);

  fragColor = vec4(color + (grain(gl_FragCoord.xy) - 0.5) * GRAIN, 1.0);
}
`;
