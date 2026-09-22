/**
 * Visual constants for the open-water scene: a warm low sun over deep blue
 * water, framed so the horizon sits near the top third and the middle of the
 * canvas stays a readable deep blue band. Exposure and bloom strength were
 * lowered from the upstream demo's values so the sun's bloom does not wash out
 * the right side of the frame and the title keeps its contrast.
 *
 * Every value is a fixed constant: the scene has no UI, no switch and no
 * control surface, and nothing here changes after construction.
 */
export const LOOK = {
  // ── wind sea (JONSWAP + TMA + Donelan–Banner) ──────────────────────────
  windSpeed: 10.5,
  windDirectionDeg: 300,
  fetchKm: 230,
  depth: 420,
  swell: 0.7,
  spread: 0.62,
  shortWaves: 0.0075,
  amplitude: 1.0,
  choppiness: 1.3,
  // ── foam ───────────────────────────────────────────────────────────────
  foamThreshold: 0.62,
  foamStrength: 1.05,
  foamDecay: 0.42,
  foamAmount: 0.85,
  // ── sky / sun ──────────────────────────────────────────────────────────
  sunElevationDeg: 6,
  sunAzimuthDeg: 300,
  turbidity: 3.4,
  rayleigh: 2.4,
  mie: 0.0075,
  mieG: 0.8,
  sunPower: 2.6,
  skyGain: 1.0,
  // ── water optics ───────────────────────────────────────────────────────
  clarity: 1.0,
  absorbR: 0.34,
  absorbG: 0.085,
  absorbB: 0.048,
  /** Deep blue in-scattering; a mid teal would read as tropic water. */
  scatter: '#0b4a66',
  sss: '#2fbfa2',
  sssStrength: 1.5,
  refract: 0.55,
  glitter: 1.0,
  fogDensity: 0.000085,
  // ── camera ─────────────────────────────────────────────────────────────
  /** Metres above the mean water plane. The grid shader offsets by this. */
  cameraHeight: 8,
  /** Negative looks down; -0.17 rad puts the horizon about 32% from the top. */
  cameraPitch: -0.17,
  cameraBaseYaw: 0,
  /** Bounded pointer yaw, radians either side of the base heading. */
  pointerYawRange: 0.12,
  /** Exponential approach rate for the yaw, per second. */
  yawResponse: 2.5,
  fieldOfView: 50,
  near: 0.25,
  far: 40000,
  // ── post ───────────────────────────────────────────────────────────────
  exposure: 0.8,
  bloomStrength: 0.18,
  bloomThreshold: 1.0,
  bloomKnee: 0.6,
  vignette: 0.34,
} as const;

/**
 * The look's shape with widened, non-readonly values, so a caller can start
 * from `LOOK` and vary a single field (`{ ...LOOK, sunElevationDeg: 70 }`)
 * without tripping over the literal types the shipped constants carry.
 */
export type OceanLook = {
  -readonly [K in keyof typeof LOOK]: (typeof LOOK)[K] extends string ? string : number;
};

/** Pointer coordinates are documented as [-1, 1] with +y up; clamp defensively. */
function clampUnit(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value < -1 ? -1 : value > 1 ? 1 : value;
}

/**
 * Bounded heading for one frame: the base heading plus a small pointer offset.
 * Clamping the offset here is what makes `pointerYawRange` a real bound — an
 * out-of-range or non-finite pointer can only ever reach the edge of the range,
 * and an inactive pointer leaves the heading at its base.
 */
export function pointerYaw(pointer: { x?: number; active?: boolean }, look: OceanLook): number {
  const offset = pointer.active ? clampUnit(pointer.x) : 0;
  return look.cameraBaseYaw + offset * look.pointerYawRange;
}

/**
 * Frame-rate independent exponential approach, so a throttled or resumed tab
 * cannot jump the heading and a zero delta changes nothing. The step is clamped
 * the way the runtime clamps its own frame delta.
 */
export function smoothYaw(current: number, target: number, delta: number, rate: number): number {
  if (!Number.isFinite(current)) return Number.isFinite(target) ? target : 0;
  if (!Number.isFinite(target)) return current;
  const step = Number.isFinite(delta) ? Math.min(0.25, Math.max(0, delta)) : 0;
  return current + (target - current) * (1 - Math.exp(-rate * step));
}

/** Rayleigh scattering coefficients for the Preetham sky, per channel. */
const SIMPLE_RAYLEIGH = [0.0005 / 94, 0.0005 / 40, 0.0005 / 18];
const MIE_K = [0.686, 0.678, 0.666];
const MIE_CONSTANT = 1.8399918514433978e14;

export type SunState = {
  /** Unit vector towards the sun. */
  direction: [number, number, number];
  betaR: [number, number, number];
  betaM: [number, number, number];
  /** Extraterrestrial irradiance after the horizon falloff. */
  energy: number;
  /** Direct sun colour, already warm at low elevation. */
  color: [number, number, number];
};

/** CPU-side Preetham coefficients consumed by `GL_SKY` through uniforms. */
export function sunState(look: OceanLook): SunState {
  const elevation = (look.sunElevationDeg * Math.PI) / 180;
  const azimuth = (look.sunAzimuthDeg * Math.PI) / 180;
  const raw: [number, number, number] = [
    Math.cos(elevation) * Math.cos(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.sin(azimuth),
  ];
  const length = Math.hypot(raw[0], raw[1], raw[2]);
  const direction: [number, number, number] = [raw[0] / length, raw[1] / length, raw[2] / length];

  const fade = 1 - Math.min(1, Math.max(0, 1 - Math.exp(direction[1])));
  const rayleighScale = look.rayleigh - (1 - fade);
  const betaR = SIMPLE_RAYLEIGH.map((coefficient) => coefficient * rayleighScale) as [
    number,
    number,
    number,
  ];
  const mieScale =
    0.434 * (0.2 * look.turbidity) * 10e-18 * MIE_CONSTANT * look.mie;
  const betaM = MIE_K.map((coefficient) => coefficient * mieScale) as [number, number, number];

  const cutoff = Math.PI / 1.95;
  const steepness = 1.5;
  const cosZenith = Math.min(1, Math.max(-1, direction[1]));
  const energy = 1000 * Math.max(0, 1 - Math.exp(-(cutoff - Math.acos(cosZenith)) / steepness));

  const zenith = Math.acos(Math.max(0, cosZenith));
  const slant =
    1 /
    (Math.cos(zenith) +
      0.15 * Math.pow(Math.max(93.885 - (zenith * 180) / Math.PI, 1e-3), -1.253));
  const visibility = Math.max(0, Math.min(1, (direction[1] + 0.035) * 14));
  const color = [0, 1, 2].map((channel) => {
    const transmittance = Math.exp(
      -(betaR[channel] * 8.4e3 + betaM[channel] * 1.25e3) * slant,
    );
    return transmittance * look.sunPower * visibility;
  }) as [number, number, number];

  return { direction, betaR, betaM, energy, color };
}
