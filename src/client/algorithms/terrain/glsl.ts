// GLSL for the terrain scene: the shared height field (a line-by-line mirror of
// ./height.ts), the surface material, the water surface and the procedural sky.
//
// The noise primitives themselves are the verbatim upstream GLSL in
// ../../vendor/terrain/noise-glsl.ts. The numeric constants below are rendered
// from the TypeScript constants in ./height.ts, so the CPU reference and the
// shaders cannot drift apart.
import { NOISE_GLSL, NOISE_STACK_PRIMS2D_GLSL } from '../../vendor/terrain/noise-glsl';
import {
  terrainFlowDirection,
  terrainFlowMeander,
  terrainFlowMeanderScale,
  terrainFlowWidth,
  terrainFrequency,
  terrainHeightRef,
  terrainHeightScale,
  terrainLacunarity,
  terrainPersistence,
  terrainSeedX,
  terrainSeedZ,
  terrainViewHalf,
  terrainWarp,
} from './height';

/** GLSL needs a decimal point on float literals; integers would be int typed. */
function glslFloat(value: number) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

/**
 * Upstream NOISE_GLSL's fbm / ridgedFBM read the octave count and the
 * persistence/lacunarity pair from the includer. The scene keeps upstream's
 * defaults and bakes the octave count its own height field needs.
 */
const noisePrelude = /* glsl */ `
#define OCTAVES 4
const float uPersistence = ${glslFloat(terrainPersistence)};
const float uLacunarity = ${glslFloat(terrainLacunarity)};
${NOISE_GLSL}
${NOISE_STACK_PRIMS2D_GLSL}
`;

const heightConstants = /* glsl */ `
const float terrainFrequency = ${glslFloat(terrainFrequency)};
const vec2 terrainSeed = vec2(${glslFloat(terrainSeedX)}, ${glslFloat(terrainSeedZ)});
const float terrainWarp = ${glslFloat(terrainWarp)};
const float terrainHeightScale = ${glslFloat(terrainHeightScale)};
const float terrainHeightRef = ${glslFloat(terrainHeightRef)};
const float terrainViewHalf = ${glslFloat(terrainViewHalf)};
const float terrainFlowDirection = ${glslFloat(terrainFlowDirection)};
const float terrainFlowWidth = ${glslFloat(terrainFlowWidth)};
const float terrainFlowMeander = ${glslFloat(terrainFlowMeander)};
const float terrainFlowMeanderScale = ${glslFloat(terrainFlowMeanderScale)};
`;

/**
 * Same shape as the vendored ridgedFBM, with the octave count baked as a
 * literal so the 4-octave warp/base fBM can coexist in one shader.
 */
const ridgeGLSL = /* glsl */ `
float terrainRidged3(vec2 p) {
  float amplitude = 0.5;
  float sum = 0.0;
  float norm = 0.0;
  float carry = 1.0;
  for (int i = 0; i < 3; i++) {
    float value = vnoise(p);
    float ridge = 1.0 - abs(value * 2.0 - 1.0);
    ridge *= ridge;
    sum += amplitude * ridge * carry;
    carry = clamp(ridge * 1.4, 0.0, 1.0);
    norm += amplitude;
    amplitude *= uPersistence;
    p = ROT2 * p * uLacunarity;
  }
  return sum / max(norm, 1e-4);
}
`;

/** worldXZ -> the height field. Pure: no camera, clock or viewport input. */
const heightFieldGLSL = /* glsl */ `
float terrainChannel(vec2 p) {
  vec2 dir = vec2(cos(terrainFlowDirection), sin(terrainFlowDirection));
  float across = dot(p, vec2(-dir.y, dir.x));
  float along = dot(p, dir);
  across += (vnoise(vec2(along * terrainFlowMeanderScale, 13.1)) - 0.5) * terrainFlowMeander;
  return clamp(exp(-pow(across / max(terrainFlowWidth, 0.02), 2.0)), 0.0, 1.0);
}

// Continuous valley mask: 0 on mountain chains, 1 on the lake floor.
float terrainValleyAt(vec2 xz, vec2 p) {
  float flow = terrainChannel(p * 0.60 + vec2(61.4, 27.8));
  // Reversed smoothstep edges are undefined in GLSL, so the inverted ramp is
  // written as 1.0 - smoothstep with ascending edges.
  float basin = 1.0 - smoothstep(0.32, 0.66, vnoise(p * 0.33 + vec2(5.1, 17.7)));
  float open = smoothstep(terrainViewHalf * 0.60, terrainViewHalf * 1.45, length(xz));
  float blended = clamp(flow * 0.85 + basin * 0.70, 0.0, 1.0);
  return clamp(max(blended, (1.0 - open) * 0.99), 0.0, 1.0);
}

float terrainHeight01(vec2 xz) {
  vec2 p = xz * terrainFrequency + terrainSeed;
  vec2 warp = vec2(
    fbm4(p + vec2(13.7, 41.3)),
    fbm4(p + vec2(87.2, 9.1))
  );
  vec2 q = p + (warp - 0.5) * terrainWarp;
  float floorHeight = fbm4(q) * 0.30 + 0.10;
  float ridge = pow(terrainRidged3(q * 1.7 + vec2(31.4, 27.2)), 1.2);
  float mountains = 0.35 + ridge * 0.95;
  return mix(mountains, floorHeight, terrainValleyAt(xz, p));
}

float terrainHeight(vec2 xz) {
  return (terrainHeight01(xz) - terrainHeightRef) * terrainHeightScale;
}
`;

/** Exponential-squared distance fog; the early-out threshold is shared too. */
const fogGLSL = /* glsl */ `
uniform float uFogDensity;
uniform vec3 uFogColor;

float terrainFogFactor(float viewDistance) {
  float d = viewDistance * uFogDensity;
  return clamp(1.0 - exp(-(d * d)), 0.0, 1.0);
}

// Fully fogged pixels are the fog colour regardless of the surface, so the
// far ring skips all three height evaluations below.
const float terrainFogCutoff = 0.985;

void terrainFoggedColor() {
  gl_FragColor = vec4(uFogColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const terrainVertexShader = /* glsl */ `
${noisePrelude}
${heightConstants}
${ridgeGLSL}
${heightFieldGLSL}

uniform float uSkirtDepth;
attribute float aSkirt;
varying vec3 vWorldPosition;

void main() {
  // The mesh stays at the identity transform, so position.xz IS world XZ and
  // every LOD layer samples one shared height field. The skirt attribute only
  // moves the duplicate border ring down to close the seam, never sideways, so
  // the wall carries its surface edge's own height and colour.
  vec3 world = vec3(position.x, terrainHeight(position.xz), position.z);
  if (aSkirt > 0.5) world.y -= uSkirtDepth;
  vWorldPosition = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const terrainFragmentShader = /* glsl */ `
${noisePrelude}
${heightConstants}
${ridgeGLSL}
${heightFieldGLSL}
${fogGLSL}

uniform float uNormalEpsilon;
uniform float uWaterLevel;
uniform float uSnowLine;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uSnowColor;
uniform vec3 uRockColor;
uniform vec3 uVegetationColor;
uniform vec3 uDryColor;
uniform vec3 uSandColor;
varying vec3 vWorldPosition;

// Two-octave climate field; moisture drives vegetation against dry ground.
float terrainMoisture(vec2 p) {
  vec2 q = p * 0.42 + vec2(29.3, 71.9);
  float value = vnoise(q) * 0.65;
  q = ROT2 * q * 2.05;
  return value + vnoise(q) * 0.35;
}

void main() {
  vec2 xz = vWorldPosition.xz;
  float viewDistance = length(cameraPosition - vWorldPosition);
  float fog = terrainFogFactor(viewDistance);
  if (fog >= terrainFogCutoff) {
    terrainFoggedColor();
    return;
  }

  // Forward differences on the same height field the vertex shader used.
  float hC = terrainHeight(xz);
  float hX = terrainHeight(xz + vec2(uNormalEpsilon, 0.0));
  float hZ = terrainHeight(xz + vec2(0.0, uNormalEpsilon));
  vec3 normalGeo = normalize(vec3(
    -(hX - hC) / uNormalEpsilon,
    1.0,
    -(hZ - hC) / uNormalEpsilon
  ));

  float h01 = clamp(hC / terrainHeightScale + terrainHeightRef, 0.0, 1.0);
  float slope = 1.0 - normalGeo.y;
  // Read from the height field, not from vWorldPosition.y: a skirt vertex is
  // dropped below its surface, and the wall must shade exactly like the edge
  // it hides so the seam does not read as a dark ring.
  float heightAboveWater = hC - uWaterLevel;

  vec2 p = xz * terrainFrequency + terrainSeed;
  float moisture = terrainMoisture(p);
  vec3 albedo = mix(uDryColor, uVegetationColor, smoothstep(0.34, 0.62, moisture));
  albedo = mix(albedo, uRockColor, smoothstep(0.26, 0.55, slope));
  albedo = mix(albedo, uRockColor, smoothstep(0.55, 0.86, h01));
  albedo = mix(albedo, uSnowColor, smoothstep(uSnowLine - 0.07, uSnowLine + 0.07, h01 - slope * 0.35));
  albedo = mix(uSandColor, albedo, smoothstep(0.0, 30.0, heightAboveWater));
  albedo *= 0.88 + 0.12 * vnoise(xz * 0.02);

  float diffuse = max(dot(normalGeo, uSunDirection), 0.0);
  vec3 ambient = uSkyColor * 0.42 * (0.5 + 0.5 * normalGeo.y);
  vec3 bounce = uGroundColor * 0.16 * (1.0 - normalGeo.y * 0.5);
  vec3 color = albedo * (uSunColor * diffuse + ambient + bounce);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const waterVertexShader = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const waterFragmentShader = /* glsl */ `
${noisePrelude}
${heightConstants}
${ridgeGLSL}
${heightFieldGLSL}
${fogGLSL}

uniform float uTime;
uniform float uWaterLevel;
uniform float uRipple;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uHorizonColor;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
varying vec3 vWorldPosition;

void main() {
  vec2 xz = vWorldPosition.xz;
  float viewDistance = length(cameraPosition - vWorldPosition);
  float fog = terrainFogFactor(viewDistance);
  if (fog >= terrainFogCutoff) {
    terrainFoggedColor();
    return;
  }

  // Two drifting noise fields tilt the surface; the terrain height field gives
  // the depth that shades shallows and the shoreline foam.
  vec2 p = xz * 0.03 + vec2(uTime * 0.035, uTime * 0.021);
  float rippleX = vnoise(p);
  float rippleZ = vnoise(p * 1.9 + vec2(41.3, 17.1));
  vec3 normal = normalize(vec3((rippleX - 0.5) * uRipple, 1.0, (rippleZ - 0.5) * uRipple));

  float depth = uWaterLevel - terrainHeight(xz);
  vec3 body = mix(uShallowColor, uDeepColor, smoothstep(0.0, 130.0, depth));
  // Foam only where the bottom is nearly at the surface: a narrow wet shoreline.
  float foam = (1.0 - smoothstep(0.0, 5.0, depth)) * (0.35 + 0.65 * rippleX);

  vec3 view = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - clamp(dot(view, normal), 0.0, 1.0), 4.0);
  float specular = pow(max(dot(reflect(-uSunDirection, normal), view), 0.0), 90.0);

  vec3 color = mix(body, uHorizonColor, fresnel * 0.45);
  color += uSunColor * specular * 0.45;
  color = mix(color, uHorizonColor, foam * 0.18);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const skyVertexShader = /* glsl */ `
varying vec3 skyDirection;

void main() {
  skyDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const skyFragmentShader = /* glsl */ `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
varying vec3 skyDirection;

void main() {
  vec3 direction = normalize(skyDirection);
  float height = smoothstep(-0.02, 0.5, direction.y);
  vec3 sky = mix(uHorizonColor, uZenithColor, height);
  float sun = max(dot(direction, uSunDirection), 0.0);
  sky += uSunColor * 0.30 * pow(sun, 12.0);
  sky = mix(sky, uSunColor * 1.5, smoothstep(0.9993, 0.9998, sun));
  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
