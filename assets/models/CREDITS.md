# Model credits

All models in this folder are CC0 1.0 (public domain). Attribution is not required, but we give it.
Each model was converted to GLB with `gltf-transform optimize` (meshopt geometry, WebP textures at 512 px).
The `@gltf-transform/cli` version for the models below was not recorded at conversion.
From 2026-10-15, convert models only with `scripts/optimize-model.sh`. It pins `@gltf-transform/cli` 4.5.1 and runs:

```
gltf-transform optimize <in> <out>.glb --compress meshopt --texture-compress webp --texture-size 512
```

| Folder | Source | Author | License | Checked |
|---|---|---|---|---|
| `nature/` | Stylized Nature MegaKit (Standard, free version) — https://quaternius.itch.io/stylized-nature-megakit | Quaternius | CC0 1.0 (`License_Standard.txt` in the pack) | 2026-10-15 |
| `village/` | KayKit Medieval Hexagon Pack 1.0 — https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 | Kay Lousberg | CC0 1.0 (`LICENSE.txt` in the repository) | 2026-10-15 |
| `furniture/` | KayKit Furniture Bits 1.0 — https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0 | Kay Lousberg | CC0 1.0 (`LICENSE.txt` in the repository) | 2026-10-15 |
