# Vanta BIRDS adaptation

Verified 2026-09-19 against **vanta 0.5.24**, Copyright 2020 Teng Bao, MIT.

- [Official interactive demo](https://www.vantajs.com/?effect=birds)
- [Fixed source](https://cdn.jsdelivr.net/npm/vanta@0.5.24/src/vanta.birds.js)
- [Upstream license](https://cdn.jsdelivr.net/npm/vanta@0.5.24/LICENSE.md)
- [Personal-page integration tutorial](https://blog.patrickskinner.tech/how-to-create-a-badass-links-page-with-3d-motion-background-using-vantajs) (reference, not copied page content)

`vanta-birds.ts` extracts the four shader strings (`fragmentShaderPosition`, `fragmentShaderVelocity`, `birdVS`, `birdFS`, upstream lines 314–552). The GPU separation, alignment, cohesion, center attraction, predator response, speed limit, flight phase and wing-flapping equations are Vanta's, not a new local Boids implementation. The bird's three-triangle geometry and the position/velocity initialization distributions come from `getNewBirdGeometry`, `fillPositionTexture` and `fillVelocityTexture`.

## Local changes

- Module exports and instance-local grid width replace global `THREE`, `VANTA`, `WIDTH`, `BIRDS` and the old CPU/mobile branch. No `Number.prototype` changes, Vanta base, window registration or legacy GPU helper are included.
- One bird's **nine** vertices reference the same simulation texel center. Upstream calculates references by triangle (`floor(vertex / 3)`) even though each bird has three triangles; the local mapping uses `floor(vertex / 9)`. This keeps body/wings together, prevents out-of-grid references and matches the full/light simulation dimensions.
- Geometry uses the original 0.2 scale and wing span 30. The original `lerpGradient` color interpolation is retained with coral-pink/cyan endpoints, using modern Three's Color handling rather than Vanta's global option helpers.
- `birdVS` guards zero horizontal velocity and floating-point rounding in its heading calculation (`max(length(velocity.xz), 0.0001)` and `sqrt(max(0., …))`). The 2026-09-21 landscape adaptation also guards center normalization, adds gentle upward steering below simulation y=-480, and maps simulated positions explicitly through `flockOrigin`/`flockScale`. This is needed because the upstream vertex shader does not apply ordinary mesh translation. Separation/alignment/cohesion, speed limits and phase remain upstream equations.
- The scenic version scales the oriented bird shape with `birdSize` and replaces the old fake z-brightness with distance haze and Three color/tone-mapping chunks. Terrain and birds share a depth buffer. Pointer coordinates are ray-projected onto the flight plane and converted back into simulation space; the original predator rule is retained.
- `flock-scene.ts` replaces Vanta's old ownership wrapper with **three 0.186.0** and that version's official `GPUComputationRenderer`. One renderer/context owns the flock and scene-local landscape owners; public dispose methods run even after partial initialization fails. Bird frustum culling is disabled because simulated positions live in textures. The scenic camera fits the valley and flight volume on portrait layouts instead of keeping the former empty-background camera formula.
- `effects/birds.ts` owns one cancellable RAF, capped full/light drawing, the host ResizeObserver and scoped pointer/visibility/context-loss listeners. Hidden tabs stop all water, mist and flock updates; abort destroys the scene. Reduced motion never imports Three. Unsupported WebGL2/float targets or runtime failure retain a static scene poster and the real page controls.
- Scenic budgets are 24×24 birds at up to30fps/DPR1.25/1.8M pixels, or16×16 at up to20fps/DPR1/0.7M pixels. A sustained-slow-frame governor can lower render resolution twice without remounting, adding RAF chains or changing the user's preference. Initialization, resize and visibility recovery restart sampling warmup.
- Neither the demo's reported FPS nor CPU-only unit tests establish real-device GPU performance. Browser checks and their limits are recorded separately in STATE.

## Licensing in the deployed site

The complete upstream notices ship as `/vendor/licenses/vanta-LICENSE.txt` and `/vendor/licenses/three-LICENSE.txt`. Three is an exact npm dependency, including its unmodified official computation helper; no runtime CDN request is needed.

To compare future changes, download the fixed source above, locate the four named template strings, and compare the shader bodies accounting for the documented numeric guards, flight floor, world-space mapping and scenic color changes. The geometry mapping, palette and lifecycle changes are intentional adaptations, not an unmodified full Vanta port.

## Dynamic lake environment (2026-09-21)

The user-approved imagegen concept supplies composition, not executable geometry or a hidden full-screen backdrop. `flock-terrain.ts` generates deterministic faceted terrain and grounded tree/rock placements. `flock-landscape.ts` batches tree/rock instances and owns a small shared noise texture for animated, depth-tested mist. All animation follows the existing hero clock.

`flock-water.ts` uses the unmodified Three0.186.0 [Reflector](https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/objects/Reflector.js) for reflected camera projection, clipping and resource disposal. Its public render callback is gated so only first draw/projection invalidation refresh the bounded, non-MSAA target. The reflection camera sees static scenery only, excluding water, birds and mist. Water displacement and ripple normals are locally authored from three bounded directional waves; Fresnel and sun-lighting treatment follows the same version's [Water](https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/objects/Water.js). This is not the full Water wrapper, not screen-space reflections and not an every-frame second scene render.

The scene uses no external models, image textures or new runtime dependencies. A compressed still poster is the reduced-motion/loading/error fallback only. Procedural terrain and scenic shader changes are local additions; their details should not be attributed to Vanta.
