#!/usr/bin/env bash
# Optimizes one source model for the web (practices/3d-asset-pipeline rule 5).
# Usage: scripts/optimize-model.sh <source.glb|.gltf|.fbx-converted.glb> <assets/models/<kit>/<Name>.glb>
set -euo pipefail
GLTF_TRANSFORM_VERSION=4.5.1
in="$1"
out="$2"
npx --yes "@gltf-transform/cli@${GLTF_TRANSFORM_VERSION}" optimize "$in" "$out" \
  --compress meshopt --texture-compress webp --texture-size 512
size=$(wc -c <"$out" | tr -d ' ')
if [ "$size" -gt 307200 ]; then
  echo "[optimize] $out is ${size} bytes. The budget is 300 KB (practices/3d-asset-pipeline rule 7)." >&2
  exit 1
fi
npx --yes "@gltf-transform/cli@${GLTF_TRANSFORM_VERSION}" inspect "$out" | head -40
