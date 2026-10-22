// BDR-012 fixture: an async interior that adds a part and then rejects. The engine must remove the
// part and build the empty room.
import * as THREE from 'three';

export default async function interior(ctx) {
  ctx.root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  await Promise.resolve();
  throw new Error('async interior broken on purpose');
}
