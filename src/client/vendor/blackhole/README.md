# Black hole with accretion disc (Eric Bruneton)

Upstream: [ebruneton/black_hole_shader](https://github.com/ebruneton/black_hole_shader), Copyright
(c) 2020 Eric Bruneton, **BSD-3-Clause**. The complete licence ships with the site at
[`public/vendor/licenses/blackhole-LICENSE.txt`](../../../public/vendor/licenses/blackhole-LICENSE.txt).

Two revisions are pinned, and `manifest.json` records URL, revision, byte length and SHA-256 for
every file taken from each:

| revision                                   | what it is               | used for                                                                                         |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `e72b3f293409893a6fa25528b29572c96fc57f57` | source                   | the GLSL model and the camera, copied into `source/` and reused by `../../algorithms/blackhole/` |
| `0a65035fa6ed8557b7bcb1492894c55f555fdae8` | `gh-pages` data revision | the four precomputed tables and the noise pattern, deployed under `/vendor/blackhole/`           |

The ray tracing itself is the upstream implementation, not a reimplementation: the deflection and
inverse-radius tables, the black body colour table, the Doppler table, the accretion disc
intersections, the anti-aliased disc edges, the lensing and the Doppler/beaming factor all come from
`functions.glsl` and `model.glsl`. `source/` holds the untouched upstream files so every claim below
can be diffed against them.

## Deployed data

| file                 | bytes     | layout                                                |
| -------------------- | --------- | ----------------------------------------------------- |
| `deflection.dat`     | 2,097,160 | 2D RG32F 512×512 behind an 8-byte width/height header |
| `inverse_radius.dat` | 16,392    | 2D RG32F 64×32 behind an 8-byte width/height header   |
| `doppler.dat`        | 1,572,864 | 3D RGB32F 64×32×64, no header                         |
| `black_body.dat`     | 1,536     | 2D RGB32F 128×1, no header                            |
| `noise_texture.png`  | 13,774    | 8-bit RGBA PNG, 128×128, opaque alpha, uploaded as R8 |

3.7 MB in total, loaded only when the effect is selected. `lut.ts` checks the header and the exact
byte length of each file before upload, so a truncated or substituted table fails the scene instead
of rendering wrong numbers. The Gaia sky survey tiles (516 files, about 256 MB) and the Tycho-2 star
cube map are **not** part of this deployment.

## Differences from upstream

1. **The sky is procedural.** `GalaxyColor` samples a deterministic starfield instead of the Gaia
   cube map: hash points on the sphere (three layers, cell-confined kernels, no pole pinch and no
   cell or face clipping) plus a low-brightness value-noise nebula and a soft galactic band. The
   seed is fixed in `shader.ts` and passed as a uniform. `StarColor` keeps the upstream `STARS 0`
   path, so the Tycho-2 star cube map and `DefaultStarColor` are gone. The ray _geometry_ is
   untouched: the sky is still sampled along the deflected direction, so the lensing of the
   background, the shadow and the Einstein rings are the model's own.
2. **Fixed defines, dead branches removed.** `LENSING 1`, `DOPPLER 1`, `GRID 0`, `STARS 0` are
   compiled in, so the flat-space `TraceRayEuclidean` fallback, the debug `GridDiscColor` and the
   `DOPPLER == 0` reset are not emitted. `STARS_CUBE_MAP_SIZE`, `MAX_FOOTPRINT_SIZE`,
   `MAX_FOOTPRINT_LOD` and the star/galaxy cube map uniforms are gone with them.
3. **Real prototypes.** Upstream lists the functions the scene must provide in a comment and relies
   on the order of its assembled files; here that list is emitted as real declarations, because the
   definitions follow `SceneColor` in a single source.
4. **Output stage.** The HDR scene colour is tone mapped in the same fragment (ACES curve and
   exposure placement as the upstream render pass, clamped before `pow`) instead of rendering to a
   float buffer and adding the upstream multi-level bloom. No float render target, no float
   blending, no `EXT_color_buffer_float`/`EXT_float_blend`.
5. **Camera.** A static observer at a fixed radius of 18 (the upstream demo orbits at about 35) with
   a bounded pointer orbit, evaluated through the upstream uniform transform (`p`, `k_s`, `e_tau`,
   `e_w`, `e_h`, `e_d`, `camera_position`). Two upstream terms are exact identities here: a zero
   4-velocity makes the Lorentz boost the identity, and an orbit azimuth of `phi = 0` makes the
   orbit-frame rotation the identity. `camera.ts` documents that reduction and
   `tests/blackhole.test.ts` checks it against a direct port of the upstream matrix pipeline.
6. **Frame centre.** Upstream centres the view on the observer's own axis. This scene uploads a
   `view_center` uniform instead, and `blackHoleFraming(aspect)` in `camera.ts` picks it from the
   viewport's aspect: the subject sits right of the copy in a wide viewport, and lower in a narrow
   one, with `(0.5, 0.5)` the upstream framing. Only the frame centre moves; the camera frame
   vectors are the upstream transform untouched.
7. **Disc ring parameters from a fixed seed.** Upstream draws them with `Math.random()` while
   assembling the shader; the same formulas and the same orbit integral run from a seeded generator
   here, so the disc is identical on every load.
8. **Single-file assembly.** The upstream files are included in the upstream order (`header + disc
constants + model.glsl + fragment shader`), with the documentation comments of `functions.glsl`
   and `model.glsl` removed (those are the paper's figures and derivations). Every function body is
   otherwise identical apart from line wrapping, which `tests/blackhole.test.ts` verifies against
   `source/`.
9. **No editor, no rocket, no upstream RAF.** No settings panel, orbit panel, rocket, exhaust,
   environment-map pass, star-loading progress bar, automatic "stars disabled for performance"
   notice or `requestAnimationFrame` loop is ported. The hero runtime owns the frame loop.
10. **No `EXT_texture_filter_anisotropic`.** Only `OES_texture_float_linear` is required, which is
    what the LINEAR sampling of the tables actually needs; the disc noise is mipmapped without
    anisotropic filtering. A device without the extension keeps the static fallback image.
11. **Decoding.** The noise PNG is fetched through `fetch` (so it is abortable) and decoded with
    `createImageBitmap`; the bitmap's premultiply state is set to `none` so the red channel is
    uploaded exactly as stored. Upstream uses `new Image()`, whose upload ignores the flip flags for
    bitmaps anyway; the pattern is a homogeneous tiling field, so any flip or rotation is visually
    irrelevant.

## Look parameters

`disc_params` (density 0.0977, opacity 0.3, temperature 2691.5 K) keeps the upstream demo's slider
defaults. `SCENE_EXPOSURE` in `scene.ts` scales the HDR colour before the ACES curve; the upstream
demo has the same multiplication, but in a separate pass that first mixes in its multi-level bloom,
so the constant is this site's own.

`tests/blackhole.test.ts` covers the table formats and their failures, the vendored bytes against
`manifest.json`, the seeded disc, the camera reduction, the frame centre at a range of aspects and
budgets, and the assembled shader (upstream bodies verbatim, fixed defines, no star cube map or
bloom). It is not a GPU or browser check: shader compilation and the rendered look still need the
browser verification of the integration step.
