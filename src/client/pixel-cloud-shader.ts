// Local adaptation of Paper Shaders 0.0.80 Dithering (Apache-2.0).
// Keep its simplex implementation, pixel coordinates and Bayer output unchanged.
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
  return cloudFbm(drift + warp * 1.35);
}`;
  return source.slice(0, start) + smoke + source.slice(start + originalNoise.length);
}
