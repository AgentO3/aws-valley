---
id: aframe
layer: presentation
extends:
  - javascript
---

# A-Frame

## Purpose

A-Frame is a declarative WebXR framework on top of three.js. A page declares an `<a-scene>`, and the browser renders the scene on desktop, on mobile, and in a VR headset. Without shared rules, teams load two copies of three.js, put game logic into HTML templates, allocate objects in each frame, and add post-processing that breaks VR. This spec keeps A-Frame scenes data-driven, deterministic, fast in XR, and testable from a headless browser.

## Do

- Pin the A-Frame script to an exact release URL, for example `https://aframe.io/releases/1.7.0/aframe.min.js`.
- Use the `THREE` object that A-Frame supplies. Give it to three.js addon modules through an import map.
- Write the scene data for a page as one JSON object. Build the entities from that object in one engine script.
- Load each GLB model one time. Cache the load promise. Clone the model or draw it as instances.
- Use a seeded random number generator for procedural placement. Make the seed from a stable page ID.
- Expose a read-only debug object on `window` (for example `window.__placeDebug`) for smoke tests.

## Don't

- Load a second copy of three.js. Two copies break `instanceof` checks and the loaders.
- Generate entity markup with the template engine. Templates write data. JavaScript builds the scene.
- Allocate `Vector3`, `Matrix4` or other objects inside `tick`. Reuse objects that you make in `init`.
- Run post-processing passes while `renderer.xr.isPresenting` is true.
- Fail without a message when a model does not load.

## References

- **external** `https://aframe.io/docs/1.7.0/` — A-Frame documentation for the pinned release
- **external** `https://aframe.io/docs/1.7.0/core/component.html` — Component lifecycle: `schema`, `init`, `tick`, `remove`
- **external** `https://threejs.org/docs/#manual/en/introduction/Installation` — Import maps and addon modules
- **external** `https://immersiveweb.dev/` — WebXR browser support and the secure-context requirement

## Rules

1. Pin A-Frame to one exact version. Pin the `three/addons/` import map entry to the three.js release that the A-Frame version bundles (A-Frame 1.7.0 bundles three.js r173).
2. Map the bare specifier `three` to a module that re-exports `window.THREE`. Addon modules must not import a separate build of three.js.
3. Pin every other CDN script (for example `meshoptimizer`) to an exact version.
4. Keep one engine script for each scene type. The engine reads one data object (for example `window.PLACE`) and builds all entities from it.
5. Make all procedural layout deterministic. The same data object must always give the same scene.
6. Put per-frame logic in a registered component `tick` handler. Do not use a separate `requestAnimationFrame` loop for scene logic.
7. Do not allocate objects in `tick`. Do not query the DOM in `tick`.
8. Use `THREE.InstancedMesh` for a prop that occurs more than about 20 times in one scene.
9. Enable shadows only on the objects that need them. Set `castShadow` and `receiveShadow` explicitly on each mesh.
10. Set tone mapping to `ACESFilmic` on the renderer. Set `toneMappingExposure` from the scene data, not from a constant in the code.
11. Desktop movement must work with the keyboard and the mouse (`wasd-controls`, `look-controls` with pointer lock). VR mode must stay available through `vr-mode-ui`.
12. Skip post-processing (for example bloom) when `renderer.xr.isPresenting` is true. Send the normal render call straight to the renderer in XR.
13. Log each load failure with `console.error` and a subsystem tag, for example `[kit]`. Log each data problem with `console.warn` and a tag, for example `[place]`. A page must render the rest of the scene after a load failure.
14. Show a fade overlay until the first frame is ready. Fade out again before each page change.
15. Expose the computed layout (positions, triggers, pending loads) on a `window.__*Debug` object. Tests read this object. Production code must not write to it.
