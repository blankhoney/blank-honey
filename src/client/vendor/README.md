# StPageFlip soft-page renderer

`page-flip.js` and `page-flip.css` are readable, unminified browser bundles built from [StPageFlip 2.0.7](https://github.com/Nodlik/StPageFlip), commit `ab30ecc1d9f6d98de1a99b8e296469382f41c120` (the npm package's `gitHead`). Copyright (c) 2020 Nodlik, MIT. The complete license ships at [`public/vendor/licenses/page-flip-LICENSE.txt`](../../../public/vendor/licenses/page-flip-LICENSE.txt).

The page geometry, clipping, HTML front/back rendering and shadows remain the upstream implementation. This is not a newly written paper-fold algorithm. The adapter in `../page-turn.ts` uses an ephemeral, noninteractive, portrait book; neither its host nor its pages are the real application DOM.

## Local lifecycle fixes

`page-flip.patch` records the exact changes against that commit:

- Render stores its RAF id, cancels it on destroy, drops animation callbacks, and checks disposal both before and after a frame. A completion listener can destroy the overlay synchronously without scheduling another frame.
- PageFlip destroys the renderer and cancels deferred initialization. Destruction is idempotent, including partial initialization.
- UI always removes resize listeners, even with `useMouseEvents: false`; tracked touch delays are cancelled and cannot start a gesture after disposal.
- The upstream `.sft__wrapper` selector typo is corrected to `.stf__wrapper`.
- Programmatic-only (`useMouseEvents: false`) turns keep `flippingTime` independent of pixel width. Upstream scales short travel distances by `size / 1000`, which made a 230px mobile page finish in about 280ms instead of the configured 750ms. Interactive gesture timing and all fold geometry remain unchanged.

No global RAF interception, private runtime monkeypatching, interactive gesture capture, or replacement of the application router is required.

## Rebuild

Fetch that exact upstream source, apply `page-flip.patch`, then bundle `src/PageFlip.ts` with esbuild (`bundle: true`, `format: 'esm'`, `platform: 'browser'`, `target: 'es2022'`, `minify: false`). Set the build's working directory to the upstream root to retain relative upstream source names rather than local machine paths. Retain the license banner on both output files. esbuild emits the imported upstream CSS separately; the Base layout imports it explicitly, before the application's page-turn styles.

The generated JavaScript retains upstream JSDoc/CSS-string trailing spaces, and the unified patch retains blank context prefixes. `.gitattributes` disables only `blank-at-eol` for those two exact files; other whitespace checks and application-source checks remain enabled. Do not trim patch context or silently rewrite upstream strings to satisfy formatting.

Regeneration is a maintenance operation, not a production install/build hook. The deployed app never fetches implementation code from GitHub or a runtime CDN. Recheck RAF, timers, resize cleanup, interrupted flips and portrait layout after any upstream update.
