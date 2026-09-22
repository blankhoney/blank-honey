# ProceduralTerrains noise primitives

`noise-glsl.ts` carries two GLSL string constants copied verbatim from
[ZyFou/ProceduralTerrains](https://github.com/ZyFou/ProceduralTerrains) at the
fixed revision `f58a8ddb81d1fbb526a41282a9a7e9c05c2d2070` (MIT, Copyright (c)
2026 ZyFou). The complete licence text ships at
[`public/vendor/licenses/terrain-LICENSE.txt`](../../../../public/vendor/licenses/terrain-LICENSE.txt).

| Constant | Upstream file | Contents |
| --- | --- | --- |
| `NOISE_GLSL` | `src/engine/terrain/terrainGLSL.js` | `hash12`, `vnoise`, `ROT2`, `fbm`, `fbm4`, `ridgedFBM` |
| `NOISE_STACK_PRIMS2D_GLSL` | `src/engine/terrain/noise/noisePrimsGLSL.js` | `vnoised2`, `valueNoise2`, `whiteNoise2`, `voronoi2`, `crater2`, `dune2`, `flow2` |

Both template literals are byte-identical to the upstream text (verified by
hashing the extracted bodies against the upstream files). Nothing in
`noise-glsl.ts` is edited, reordered or reformatted; upstream comments are kept
because they document the ANGLE/D3D11 constraint on loop bounds.

## What was not copied

Only the two strings above are vendored. The rest of the upstream project — the
roughly 540KB `Engine` and editor shell, the React application, the account and
cloud project services, the material/graph editors, the erosion worker, the
surface texture atlas, the Blender and Unity plugins, the bundled JPG surface
textures, the desktop (Electron) build and the exported download archives — is
deliberately absent. The scene does not implement the upstream erosion editor,
its graph stack, its import/paint/spline layers or its water and cloud systems,
and does not claim to.

`NOISE_STACK_PRIMS3D_GLSL` and `NOISE_STACK_MASKS2D_GLSL` are also left out:
this scene samples world XZ only, so the 3D primitives and the per-layer mask
chain are not needed.

## Adaptations in this repository

The vendored GLSL is compiled into shaders written here, not by upstream code:

- `NOISE_GLSL`'s `fbm` / `ridgedFBM` read `OCTAVES`, `uPersistence` and
  `uLacunarity` from whatever material includes them. `src/client/algorithms/terrain/glsl.ts`
  defines `OCTAVES 4` and declares both as `const float` using upstream's
  defaults (0.5, 2.05), so the verbatim text compiles unchanged.
- The scene's own 3-octave ridged fractal (`terrainRidged3`) follows the shape of
  the vendored `ridgedFBM` with the octave count baked as a literal, because one
  `#define OCTAVES` cannot serve a 4-octave warp and a 3-octave ridge in the same
  shader. This mirrors upstream's own codegen, which also emits the octave count
  as a literal per stack layer.
- The height field, the valley mask, the biome-style colouring, the sky, the
  water and the three-layer LOD geometry are written for this site. Upstream's
  `TerrainHeightSampler` / `biomeGLSL` were read as references for the
  height/slope/climate mix and for the finite-difference normal, and the CPU
  reference in `src/client/algorithms/terrain/height.ts` ports upstream's
  `Math.fround` float32 emulation of `hash12` / `vnoise` so CPU and GPU agree.
- The height field differs from any upstream preset: it is a fixed-seed,
  domain-warped 4-octave fBM plus a 3-octave ridged fractal, blended by a
  continuous valley mask, with a water level and a fixed three-ring LOD.

## Rebuild

Nothing here is generated. To refresh the vendored text, fetch the fixed
revision, extract the two template literals from the files listed in the table,
and replace the constants without reformatting them; then re-run the licence
copy and `tests/terrain.test.ts`, which checks the extracted GLSL still exposes
the primitives the shaders call.
