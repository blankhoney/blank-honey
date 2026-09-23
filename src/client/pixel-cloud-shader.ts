// Local adaptation of Paper Shaders 0.0.80 Dithering (Apache-2.0).
// Keep its simplex implementation, pixel coordinates and Bayer output unchanged; the added screen
// bank only gates how much density reaches a fragment, it never moves the pixel grid.
const originalNoise = `float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));

  return noise;
}`;

export function pixelCloudShader(source: string, light: boolean) {
  const start = source.indexOf(originalNoise);
  if (start < 0 || source.indexOf(originalNoise, start + 1) >= 0)
    throw new Error('Unsupported Paper Dithering noise function');
  const smoke = `
float cloudFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float weight = 0.0;
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  for (int octave = 0; octave < ${light ? 2 : 3}; octave++) {
    value += amplitude * snoise(p);
    weight += amplitude;
    p = turn * p * 2.03 + vec2(7.1, 3.7);
    amplitude *= 0.5;
  }
  return value / weight;
}

float getSimplexNoise(vec2 uv, float t) {
  // Distinct time trajectories deform the density, not just its screen position.
  vec2 drift = uv + vec2(-0.16, -0.11) * t;
  vec2 warp = vec2(
    cloudFbm(uv * 0.72 + vec2(0.09, -0.17) * t),
    cloudFbm(uv * 0.72 + vec2(5.2, 1.3) + vec2(-0.13, 0.08) * t)
  );
  float density = cloudFbm(drift + warp * .85);
  // Steady screen band, never time random: the canvas coordinate runs from zero at its bottom edge
  // to one at its top, so the mix returns pure black over the title and inside the bottom footer.
  vec2 screen = gl_FragCoord.xy / u_resolution;
  float bank = 1.0 - smoothstep(.32, .60, screen.y + .08 * sin(screen.x * 5.2));
  float footer = smoothstep(.10, .20, screen.y);
  return mix(-1.0, density, bank * footer);
}`;
  return source.slice(0, start) + smoke + source.slice(start + originalNoise.length);
}
