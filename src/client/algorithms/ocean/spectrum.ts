/**
 * JONSWAP + TMA + Donelan–Banner wind-sea spectrum, ported from the fixed
 * upstream shader (`h0Pass` in `src/client/vendor/ocean/index.html`).
 *
 * The GPU evaluates the same formulas in GLSL. These TypeScript exports exist
 * so the numbers can be checked against analytic wave theory in Node, where no
 * GL context is available; they are also the source of truth for the constants
 * the shader is calibrated against.
 */

export const GRAVITY = 9.81;
const PI = Math.PI;
const TWO_PI = Math.PI * 2;

/**
 * Upstream `KCAL`. Calibrated so a unit amplitude reproduces the Hasselmann
 * fetch-limited significant wave height `Hs = 0.0016·sqrt(gF)/U · U²/g`.
 */
export const SPECTRUM_CALIBRATION = 0.13;

/** Deterministic spectrum seed used by the shipped scene (upstream default). */
export const SPECTRUM_SEED = 1337;

/** Bound on `k·depth` inside tanh/sinh, matching `min(k*uDepth, 20.0)` upstream. */
const DEPTH_ARGUMENT_LIMIT = 20;

/** 32-bit PCG hash, matching the shader's `pcg(uint)`. */
export function pcg(value: number): number {
  const state = (Math.imul(value, 747796405) + 2891336453) >>> 0;
  const shift = ((state >>> 28) + 4) >>> 0;
  const word = Math.imul((state >>> shift) ^ state, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

/** Uniform [0, 1) draw from the same hash stream the shader uses. */
export function uniformFromHash(hash: number): number {
  return pcg(hash) * (1 / 4294967296);
}

export type GaussianPair = [number, number];

/**
 * Box–Muller pair keyed on the signed texel index and a seed. Reproducible
 * across runs and identical to the shader's `gauss2(nx, nz)`.
 */
export function gaussianPair(nx: number, nz: number, seed: number): GaussianPair {
  const hash =
    (Math.imul(nx + 262144, 1973) + Math.imul(nz + 262144, 9277) + Math.imul(seed, 26699)) >>> 0;
  const u1 = Math.max(1e-7, uniformFromHash(hash));
  const u2 = uniformFromHash((hash ^ 0x9e3779b9) >>> 0);
  const radius = Math.sqrt(-2 * Math.log(u1));
  return [radius * Math.cos(TWO_PI * u2), radius * Math.sin(TWO_PI * u2)];
}

/** Deep-water angular frequency, ω = sqrt(g·k·tanh(k·h)). */
export function angularFrequency(wavenumber: number, depth: number): number {
  return Math.sqrt(GRAVITY * wavenumber * Math.tanh(Math.min(wavenumber * depth, DEPTH_ARGUMENT_LIMIT)));
}

/** dω/dk, needed because a JONSWAP frequency spectrum is converted to wavenumber. */
export function angularFrequencyDerivative(wavenumber: number, depth: number): number {
  const scaled = Math.min(wavenumber * depth, DEPTH_ARGUMENT_LIMIT);
  const tanh = Math.tanh(scaled);
  const cosh = Math.cosh(scaled);
  const omega = Math.max(Math.sqrt(GRAVITY * wavenumber * tanh), 1e-6);
  return (GRAVITY * ((depth * wavenumber) / (cosh * cosh) + tanh)) / (2 * omega);
}

export function jonswap(omega: number, peak: number, alpha: number): number {
  const sigma = omega <= peak ? 0.07 : 0.09;
  const peakShape = Math.exp(-((omega - peak) * (omega - peak)) / (2 * sigma * sigma * peak * peak));
  const inverse = 1 / Math.max(omega, 1e-4);
  const ratio = peak * inverse;
  const ratioFourth = ratio * ratio * ratio * ratio;
  return (
    alpha *
    GRAVITY *
    GRAVITY *
    Math.pow(inverse, 5) *
    Math.exp(-1.25 * ratioFourth) *
    Math.pow(3.3, peakShape)
  );
}

/** TMA shallow-water correction factor. */
export function tmaFactor(omega: number, depth: number): number {
  const scaled = omega * Math.sqrt(depth / GRAVITY);
  if (scaled <= 1) return 0.5 * scaled * scaled;
  if (scaled < 2) return 1 - 0.5 * (2 - scaled) * (2 - scaled);
  return 1;
}

/** Longuet-Higgins normalisation for the cos^(2s) spreading function. */
export function spreadingNormalisation(exponent: number): number {
  const s2 = exponent * exponent;
  const s3 = s2 * exponent;
  const s4 = s3 * exponent;
  if (exponent < 5) return -0.000564 * s4 + 0.00776 * s3 - 0.044 * s2 + 0.192 * exponent + 0.163;
  return -4.8e-8 * s4 + 1.07e-5 * s3 - 9.53e-4 * s2 + 5.9e-2 * exponent + 3.93e-1;
}

export function cosineSquaredSpread(theta: number, exponent: number): number {
  return spreadingNormalisation(exponent) * Math.pow(Math.abs(Math.cos(0.5 * theta)), 2 * exponent);
}

/** Directional spreading exponent, with the low-frequency swell lobe added. */
export function spreadingExponent(omega: number, peak: number, swell: number): number {
  const power = omega > peak ? 9.77 * Math.pow(omega / peak, -2.5) : 6.97 * Math.pow(omega / peak, 5);
  return power + 16 * Math.tanh(Math.min(omega / peak, 20)) * swell * swell;
}

/**
 * Blends a pure cosine-squared lobe into the Longuet–Higgins lobe. `spread` of
 * 1 is fully Longuet–Higgins, 0 is `(2/π)cos²θ` limited to the half plane.
 */
export function directionalSpectrum(
  theta: number,
  omega: number,
  peak: number,
  swell: number,
  spread: number,
): number {
  const exponent = spreadingExponent(omega, peak, swell);
  const cosine = Math.cos(theta);
  const narrowLobe = (2 / PI) * cosine * cosine * (cosine >= 0 ? 1 : 0);
  return narrowLobe * (1 - spread) + cosineSquaredSpread(theta, exponent) * spread;
}

export type SpectralField = {
  /** Tile edge length in metres; the wavenumber grid step is 2π / tileLength. */
  tileLength: number;
  /** FFT resolution; texel (x, z) maps to wavenumber (x - N/2, z - N/2) · dk. */
  fftSize: number;
  windSpeed: number;
  /** Unit vector the wind blows towards. */
  windDirectionX: number;
  windDirectionY: number;
  /** Fetch in kilometres, converted to metres the way the parameter sync does. */
  fetchKm: number;
  depth: number;
  swell: number;
  spread: number;
  shortWaves: number;
  amplitude: number;
  cutLow: number;
  cutHigh: number;
  seed: number;
};

export type SpectralSample = {
  /** ĥ(k), the realisation for the positive wavenumber. */
  forward: GaussianPair;
  /** ĥ(−k), which supplies the Hermitian partner. */
  reverse: GaussianPair;
  omega: number;
};

/**
 * One texel of `h0Pass`. Texel indices are signed and wrap the spectrum so that
 * `(nx, nz)` and `(-nx, -nz)` are independent draws: the resulting pair is
 * Hermitian, which is what makes the inverse transform produce a real surface.
 */
export function spectralSample(nx: number, nz: number, field: SpectralField): SpectralSample {
  const dk = TWO_PI / field.tileLength;
  const kx = nx * dk;
  const kz = nz * dk;
  const wavenumber = Math.hypot(kx, kz);
  if (wavenumber <= 1e-6 || wavenumber < field.cutLow || wavenumber >= field.cutHigh)
    return { forward: [0, 0], reverse: [0, 0], omega: 0 };

  const windSpeed = Math.max(field.windSpeed, 0.6);
  const fetch = Math.max(field.fetchKm * 1000, 100);
  const peak = 22 * Math.pow((GRAVITY * GRAVITY) / (windSpeed * fetch), 1 / 3);
  const alpha = 0.076 * Math.pow((windSpeed * windSpeed) / (fetch * GRAVITY), 0.22);
  const omega = angularFrequency(wavenumber, field.depth);
  const base =
    jonswap(omega, peak, alpha) *
    tmaFactor(omega, field.depth) *
    Math.exp(-wavenumber * wavenumber * field.shortWaves * field.shortWaves) *
    (Math.abs(angularFrequencyDerivative(wavenumber, field.depth)) / wavenumber) *
    dk *
    dk;

  const thetaK = Math.atan2(kz, kx);
  const thetaW = Math.atan2(field.windDirectionY, field.windDirectionX);
  const deltaTheta = thetaK - thetaW;

  const forwardAmplitude =
    Math.sqrt(
      SPECTRUM_CALIBRATION *
        Math.max(base * directionalSpectrum(deltaTheta, omega, peak, field.swell, field.spread), 0),
    ) * field.amplitude;
  const reverseAmplitude =
    Math.sqrt(
      SPECTRUM_CALIBRATION *
        Math.max(
          base * directionalSpectrum(deltaTheta + PI, omega, peak, field.swell, field.spread),
          0,
        ),
    ) * field.amplitude;

  const forwardDraw = gaussianPair(nx, nz, field.seed);
  const reverseDraw = gaussianPair(-nx, -nz, field.seed);
  return {
    forward: [forwardDraw[0] * forwardAmplitude, forwardDraw[1] * forwardAmplitude],
    reverse: [reverseDraw[0] * reverseAmplitude, reverseDraw[1] * reverseAmplitude],
    omega,
  };
}

/** Peak angular frequency of the fetch-limited spectrum, exposed for tests. */
export function peakAngularFrequency(field: SpectralField): number {
  const windSpeed = Math.max(field.windSpeed, 0.6);
  const fetch = Math.max(field.fetchKm * 1000, 100);
  return 22 * Math.pow((GRAVITY * GRAVITY) / (windSpeed * fetch), 1 / 3);
}
