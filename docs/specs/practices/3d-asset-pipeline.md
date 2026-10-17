---
id: 3d-asset-pipeline
layer: practices
extends: []
---

# 3D Asset Pipeline

## Purpose

A web 3D project ships binary models and textures. These files have licenses, sizes and coordinate conventions. Without a defined pipeline, teams commit models with an unknown license, ship 20 MB scenes, mix units and axis directions, and cannot reproduce an optimized file from its source. This spec defines how a team selects, records, optimizes, checks and commits glTF assets for the web.

## Do

- Use only assets with a license that permits redistribution, preferably CC0.
- Record each asset kit in `CREDITS.md`: source URL, author, license, and the date of the license check.
- Optimize each model with `gltf-transform optimize` before you commit it.
- Commit only the optimized `.glb` files. Keep source packs out of the repository.
- Keep a size budget for each model and for each page.
- Use one unit and one axis convention for all assets: metres, +Y up, front toward +Z.

## Don't

- Commit an asset when you do not know its license.
- Use an asset with a non-commercial (NC) or no-derivatives (ND) license.
- Edit an optimized `.glb` by hand. Make it again from the source with the same command.
- Load a meshopt-compressed model without a registered `MeshoptDecoder`.

## References

- **external** `https://gltf-transform.dev/cli` — `gltf-transform` CLI, `optimize` and `inspect`
- **external** `https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html` — glTF 2.0 specification (units and axes)
- **external** `https://github.com/zeux/meshoptimizer` — Meshopt compression and decoder
- **external** `https://creativecommons.org/publicdomain/zero/1.0/` — CC0 1.0 deed

## Rules

1. Accept only CC0 1.0, CC-BY 4.0 or an equivalent license that permits redistribution and change. Do not accept NC or ND licenses.
2. Before the first commit of a kit, read the license file in the pack. Add one row to `CREDITS.md` with: folder, source URL, author, license (with the license file name), and the date of the check.
3. Credit authors in `CREDITS.md` also when the license does not require it.
4. Keep one folder for each source kit under `assets/models/<kit>/`. Keep the upstream file names.
5. Make each committed model with this command, or a documented variant: `gltf-transform optimize <in> <out>.glb --compress meshopt --texture-compress webp --texture-size 512`.
6. Record the exact optimize command and the `@gltf-transform/cli` version in `CREDITS.md` or in a script in the repository.
7. A single model must be 300 KB or smaller. The models for one page must be 3 MB or smaller in total. An exception needs an ADR.
8. Before you commit a model, run `gltf-transform inspect` on it. Check the draw call count, the vertex count and the texture sizes.
9. All models use metres, +Y up, and face +Z. Correct a model that does not match in the pipeline, not in runtime code.
10. When you use meshopt compression, the runtime must register `MeshoptDecoder` on the `GLTFLoader` before the first load.
11. Keep source packs (FBX, Blend, uncompressed glTF) out of the repository. Add their folder to `.gitignore`.
12. Serve all assets from the same origin as the site. Do not load models from the original download host.
