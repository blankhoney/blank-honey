# Gray–Scott reaction-diffusion adaptation

Verified 2026-09-22 against **piellardj/reaction-diffusion-webgl**, commit `be78fc4e6c02ea8ccc573407f37ca3a3477b9b57`, Copyright (c) 2021 Jérémie Piellard, MIT. The complete upstream license ships at [`public/vendor/licenses/reaction-LICENSE.txt`](../../../../public/vendor/licenses/reaction-LICENSE.txt).

- [Fixed source tree](https://github.com/piellardj/reaction-diffusion-webgl/tree/be78fc4e6c02ea8ccc573407f37ca3a3477b9b57)
- [Interactive upstream demo](https://piellardj.github.io/reaction-diffusion-webgl/)
- [Upstream explanations](https://piellardj.github.io/reaction-diffusion-webgl/readme)

`reaction-diffusion.ts` carries the shader code of three upstream files:

- `src/shaders/_encode-decode.frag` → `ENCODE_DECODE_GLSL`. The 16-bit-in-RGBA8 packing is upstream's, unchanged in every constant (`255.99`, `255.0 / 256.0`, `1.0 / 256.0`), and is what lets the two chemical concentrations live in ordinary 8-bit textures without a float extension.
- `src/shaders/update/_reaction-diffusion.frag` → `REACTION_UPDATE_FRAGMENT`. The 3×3 Laplacian (corners 0.05, edges 0.20, centre −1), the `A * B * B` reaction term, the feed/kill equations and `dt = 1.0` are upstream's; the display case of upstream's `update-uniform.frag` is folded in as `main`.
- `src/shaders/update/brush-apply.frag` → `REACTION_BRUSH_FRAGMENT`. Upstream's disturbance policy — discard outside the brush, otherwise write `vec2(1)` — is kept.

## Local changes

- **GLSL ES 3.00.** The shaders are ported to the version the shared surface creates: `#version 300 es`, `in`/`out` varyings, `texture()` instead of `texture2D()`, an explicit `fragColor` output instead of `gl_FragColor`, and the `#include` step replaced by string composition. `vSamplingPosition` is renamed to `vUv`, the name the shared fullscreen-triangle vertex shader exports. One upstream trailing comma in a `vec2(...)` argument list is dropped, which is punctuation only.
- **`precision highp float` and `precision highp sampler2D`** replace upstream's `mediump`. `mediump` is not enough for the packing on hardware that really uses 16-bit floats: the low byte would be lost and the decoded concentration would be visibly quantized.
- **The fullscreen triangle replaces upstream's quad vertex shaders.** `update.vert` and `brush.vert` (and their `aCorner` attribute buffer) are not needed; the brush circle is measured in simulation coordinates in the fragment shader instead of in a positioned quad.
- **Upstream's page machinery is not included.** No `Page` global, no controls/tabs/presets/range inputs, no `ShaderManager` XHR loading of shader files, no iteration indicator, no image download, no value-picking map, no `cat.jpg`/`colorscale.png`/`greyscale.png` textures, no tricolor or monochrome/ramp display modes, no reset shader with its disc/circle patterns, no per-frame FPS probe (`computeNbIterationsForThisFrame`), and no brush cursor display pass. The reset patterns are replaced by the deterministic CPU seed described below; the display pass is locally written.
- **Iteration budget and grid size are fixed by the hero runtime** (512² with 8 steps per displayed frame, or 256² with 4 steps on the light tier) instead of upstream's speed slider. `resize` changes the display pixels only; the simulation grid stays put.
- **The initial state is deterministic.** `createSeededState` writes A everywhere and B inside a jittered lattice of blobs from a fixed PRNG stream (the same `vec2(1)` upstream's brush and reset shader produce), and the first state is uploaded as texture bytes. Upstream instead re-runs its reset shader on resize or on demand; a hero cannot re-roll its texture on every layout change.
- **The simulation textures are sampled with `NEAREST`, and the display interpolates the decoded values.** Upstream's `RenderToTexture` sets `LINEAR` on the same RGBA8 textures and decodes whatever the sampler blended. A blend of packed bytes is not the blend of the decoded values — the low channel wraps every 256 steps — so the hero reads texel centres exactly and interpolates the decoded concentrations itself. This is a real functional difference from upstream, not a formatting detail.
- **`DITHER` is disabled for the life of the context.** GLES enables dithering by default, and with it enabled the choice between the two neighbouring 8-bit values may depend on the pixel position — the wrong property for a texture that carries data rather than colour. Hardening only: the CPU runs show the field's fate is decided by the parameters and the seed, not by sub-LSB rounding.
- **The display pass is new.** Upstream maps the field through its own colour images or binary threshold; the local pass decodes, interpolates the decoded values, and shades a local cyan-green/gold palette. See `../../algorithms/reaction/display.ts`.
- **The pointer disturbance follows the hero pointer contract** (stage coordinates, positive y up, one injection per displayed frame while the pointer is down or on a tap) and is mapped through the same aspect crop as the display, so a touched cell is the cell that lights up.

`src/client/algorithms/reaction/gray-scott.ts` is a CPU reference of the same equations for the unit tests; it is not a second implementation used at runtime.

## Parameters

The working point is feed `0.029`, kill `0.057`, with `diffuseA 0.8` / `diffuseB 0.4` at `dt = 1.0`, and a finite warm-up of 96 steps (48 on the light tier) completed before the first paint. The diffusion pair sits above every value upstream ships in its own presets (A diffusion ≤ 0.5); it is what keeps the colony alive on the 512² grid at the chosen feed/kill, where the upstream-range pair decays back to the A = 1, B = 0 state within a few hundred steps. All of them live in one object, `GRAY_SCOTT_PARAMETERS`.

The seed blobs follow the grid: one blob per 32 cells, never fewer than six per axis (`MIN_SEED_LATTICE`, `SEED_SPACING`), giving a 16×16 lattice on 512², 8×8 on 256² and the six-blob floor on anything smaller. Radius stays at 1/64 of the shorter edge, so the first paint already carries a full field of texture instead of a handful of isolated dots; the third argument of `createSeededState` still overrides the count.

## Rebuild and comparison

Fetch that commit and compare `src/shaders/_encode-decode.frag`, `src/shaders/update/_reaction-diffusion.frag` and `src/shaders/update/brush-apply.frag` against the three exports above, discounting the syntax port and the entry points listed here. The packing, stencil weights, reaction term and integration step must stay identical; the grid size, iteration budget, seeding, pointer policy and display pass are intentional local adaptations. No runtime request to GitHub, jsDelivr or any other host is needed: the shaders ship as strings inside the bundle.
