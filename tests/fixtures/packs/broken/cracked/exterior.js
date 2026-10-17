// BDR-012 fixture (risk R8): the exterior throws after it adds a part, so the parent must remove
// the part and show a plain door frame.
import * as THREE from 'three';

export default function exterior(ctx) {
  ctx.root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  throw new Error('exterior broken on purpose');
}
