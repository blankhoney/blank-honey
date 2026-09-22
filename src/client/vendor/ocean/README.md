# Abyssal Ocean (squall01337)

Upstream: [squall01337/abyssal-ocean](https://github.com/squall01337/abyssal-ocean) at the fixed
revision `142265f5013b6f27bea4f4f819b832dec75c7bad`, Copyright (c) 2026 Sacha (@squall01337),
**MIT**. The complete licence ships with the site at
[`public/vendor/licenses/ocean-LICENSE.txt`](../../../public/vendor/licenses/ocean-LICENSE.txt).

Upstream is a single-file demo — one `index.html` holding the DOM, a parameter panel, the Three.js
scene, every GLSL pass and the JavaScript spectral pipeline. That file is vendored byte for byte as
`index.html`, and `manifest.json` records its URL, revision, byte length and SHA-256. Nothing in the
deployed site fetches it: it is the reference everything below is diffed against, and
`tests/ocean.test.ts` re-hashes it so a silent edit cannot go unnoticed.

## What the ocean actually is

A Tessendorf spectral ocean, and the shipped scene runs upstream's version of it rather than a
look-alike:

| step | upstream | local |
| --- | --- | --- |
| initial spectrum `h₀(k)` | `h0Pass` (JONSWAP × TMA × Donelan–Banner spreading, depth-dependent dispersion and its derivative, short-wave cut-off, PCG hash + Box–Muller draws, `KCAL = 0.13`) | `spectrum.ts` (TypeScript) + `H0_FRAGMENT_SHADER` (GLSL), same formulas and constants |
| time evolution `h(k,t) = h₀e^{iωt} + h₀*(−k)e^{−iωt}` | `specPass`, four complex channels into two MRT slots | `SPECTRUM_FRAGMENT_SHADER`, unchanged |
| bidirectional Cooley–Tukey IFFT | `makeButterflyTexture` + `bfPass` (twiddle/index table with the bit-reversal permutation folded into stage 0) | `butterfly.ts` builds the table, `BUTTERFLY_FRAGMENT_SHADER` runs the kernel, `butterfly2d` replays it in double precision |
| displacement, slopes, Jacobian | `asmPass` (checkerboard sign, `disp = p + chop·D`, `J = (1+∂Dx/∂x)(1+∂Dz/∂z) − (∂Dx/∂z)²`) | `ASSEMBLY_FRAGMENT_SHADER`, `reference.ts` |
| foam | `foamPass` over a two-target ping-pong history | `FOAM_FRAGMENT_SHADER`, `config.ts#foamPingPong` |
| sky, refraction, absorption, reflection, sun specular, fog | `GL_SKY` (Preetham), `GL_NOISE`, `GL_DEPTH`, the ocean material | `shaders.ts`, same GLSL and same constants |
| bloom and composite | threshold → 5-level downsample → additive upsample → tent resolve, ACES, vignette, dither | same chain, 5 levels on the full tier and none on the light tier |

`reference.ts` is a double-precision CPU mirror of `specPass` → `bfPass` → `asmPass`. It is the
executable specification the tests check the table, the kernel, the packing and the Jacobian
against, including a direct O(N⁴) inverse DFT oracle. It is not imported by the scene.

## Differences from upstream

1. **No island, no sea bed, no buoys.** The JS heightfield (`terrainH`, `sampleH`), the half-float
   height lookup texture, the terrain mesh and its material, and the GPU-buoyancy buoys are gone.
   The ocean vertex shader accordingly drops `uTerrain`/`uTerrainSize` and the `shoal` factor, and
   the fragment shader drops what depended on it: the `mix(0.22, 1.0, vShoal)` normal flattening and
   the shoreline foam band (`bedAt`, `uShoreWidth`, the `sin(wd·2.7 − t·1.7)` ripple). The water is
   open sea everywhere, so the normal is the plain `(-∂η/∂x, 1, -∂η/∂z)` construction.
2. **No screen-space reflection and no underwater view.** `uSSR` (the ray march over the scene
   colour) and `uUnderwater` (the submerged shading branch and the composite's underwater fog term)
   are removed, and with them the `uUnder`/`uUWDensity` composite uniforms. Reflection is upstream's
   sky path via `skyRough`, unchanged.
3. **No readback.** The 1×1 height probe (`probePass`, the RGBA8 height encoding,
   `readRenderTargetPixels`) and the `waterY` / submerged HUD state derived from it are gone. The
   scene never reads pixels back from the GPU.
4. **No UI.** The loading screen, the `step()`/`fatal()` boot overlay, the whole parameter panel
   (sliders, checkboxes, colour rows), the keyboard shortcuts, the FPS/status readout, the mobile
   `IS_PHONE` tier check and the `P.wire`/`P.showFoam` debug switches are gone. Every parameter is a
   fixed constant in `algorithms/ocean/look.ts`.
5. **No free camera.** Upstream flies a WASD/mouse camera starting at `(-95, 16, 585)`. Here the
   camera is fixed 8 m above the mean water plane with a fixed downward pitch, looking at the
   distant sea, and the pointer only adds a small bounded yaw (`pointerYawRange`, smoothed with the
   frame delta). No vertical movement, no pitch control, no pointer lock, no drag.
6. **Frame-driven.** No `requestAnimationFrame`, no clock and no `P.timeScale`: the runtime passes
   `seconds` and `delta`, the spectrum advances by `seconds`, the foam decay integrates `delta`
   (clamped 0.0005–0.05 s, upstream's own bounds), and the yaw smoothing uses the same delta. One
   real frame is rendered during construction so a shader link failure reaches the caller instead of
   appearing as a blank canvas.
7. **Local module split.** The DOM scene setup is replaced by `scene.ts`
   (`createScene: AlgorithmFactory`, canvas + WebGL2 context + `resize`/`frame`/`dispose`), with
   `resources.ts` (reverse-order, idempotent release), `pass.ts` (fullscreen-pass helper),
   `simulation.ts` (spectral pipeline) and `render.ts` (sky dome, water mesh, bloom, composite).
   The GLSL in `shaders.ts` is assembled from the pinned file with the branches listed above
   removed and nothing else rewritten.
8. **Three 0.186.0 from the app, not a CDN.** Upstream's importmap pulls `three@0.180.0` from
   jsDelivr. This scene uses the repository's installed `three` (0.186.0) with
   `WebGLRenderer({ canvas, context })` on a context the scene creates itself, so no runtime CDN
   request is involved. The context is the scene's own to release: it is the first resource in the
   set, so it is lost through `WEBGL_lose_context` exactly once, after every render target, material
   and geometry has been disposed, including when construction fails halfway.
9. **Resolution is owned by the runtime.** `resize` calls `algorithmResolution(...)` for the drawing
   buffer, sets the CSS size to the full element size and pins `renderer.setPixelRatio(1)`, so the
   device ratio and quality scale are applied exactly once. The FFT resolution is fixed per tier and
   never follows the canvas; upstream instead renders at `size × P.scale` and lets the composite
   upsample.
10. **A missing capability throws.** Without WebGL2 or `EXT_color_buffer_float` the scene throws
    `OceanUnsupportedError` (`code: 'webgl2' | 'float-render-target'`, stable `name`) so the runtime
    can keep the static still. There is no cheap substitute wave field: a sum of sines is not this
    spectrum and would misrepresent what the scene is.
11. **Tiering.** Full tier: `N = 256`, radial grid 128 rings × 192 segments, 5 bloom levels. Light
    tier: `N = 128`, 64 × 96, no bloom (a 1×1 black texture keeps the composite branch-free instead
    of a second shader variant).

## Look parameters

The look deviates from upstream's defaults to place a warm low sun over deep blue water with the
horizon high in frame: wind 10.5 m/s from 300°, fetch 230 km, swell 0.7, sun elevation 6° at azimuth
300°, turbidity 3.4, rayleigh 2.4, scatter `#0b4a66` (upstream's `#0f5f6b` is a mid teal), exposure
0.8 and bloom strength 0.18 — both lowered from the upstream demo's 1.05 / 0.42 because the sun's
bloom washed out the right of the frame and cost the title its contrast. Depth 420 m, spread 0.62,
short-wave cut-off, choppiness 1.3, the foam threshold/strength/decay, the optical absorption
coefficients, fog density (`0.000085`), bloom threshold/knee (`1.0`/`0.6`) and the vignette (`0.34`)
are upstream's values. The camera, the exposure and the bloom strength are this site's own.

## Tests and rebuild

`tests/ocean.test.ts` covers the butterfly table and the transform against a direct inverse DFT, a
closed-form single-speckle standing wave (height, displacement, slope and Jacobian), the shipped
spectrum's finiteness and banding, the foam ping-pong rule, the tier/grid budgets, the cascade bands,
the radial grid, the canvas budget and the sunset look. It also re-hashes this vendored file against
`manifest.json`. It is not a GPU or browser check: shader compilation, the rendered look and real
device cost still need browser verification.

To refresh the vendored file, fetch `index.html` from the revision above, replace it without
reformatting, recompute the byte length and SHA-256 for `manifest.json`, and re-run the ocean tests.
Keep the licence copy in `public/vendor/licenses/` in step with any revision change.
