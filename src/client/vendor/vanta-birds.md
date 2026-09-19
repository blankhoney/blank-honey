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
- `birdVS` guards zero horizontal velocity and floating-point rounding in its heading calculation (`max(length(velocity.xz), 0.0001)` and `sqrt(max(0., …))`). Other shader equations remain unchanged; formatting is normalized in the source file.
- `flock-scene.ts` replaces Vanta's old ownership wrapper with **three 0.186.0** and that version's official `GPUComputationRenderer`. It owns render targets, initial textures, materials, geometry, renderer and context; public dispose methods run even after partial initialization fails. Geometry frustum culling is disabled because simulation positions live in textures. Portrait layouts pull the camera back by the inverse square root of the aspect ratio so a narrow viewport does not crop most of the flock off both sides.
- `effects/birds.ts` owns one cancellable RAF, capped full/light drawing, the host ResizeObserver and scoped pointer/visibility/context-loss listeners. Hidden tabs stop scheduling; abort destroys the scene. Reduced motion never imports Three. Unsupported WebGL2/float targets or runtime failure retain static decorative birds and the real page controls.
- Neither the demo's reported FPS nor CPU-only unit tests establish real-device GPU performance. Browser checks and their limits are recorded separately in STATE.

## Licensing in the deployed site

The complete upstream notices ship as `/vendor/licenses/vanta-LICENSE.txt` and `/vendor/licenses/three-LICENSE.txt`. Three is an exact npm dependency, including its unmodified official computation helper; no runtime CDN request is needed.

To compare future changes, download the fixed source above, locate the four named template strings, and compare the shader bodies with the two documented heading guards. The geometry mapping, palette and lifecycle changes are intentional adaptations, not an unmodified full Vanta port.
