// BDR-012 fixture: an async interior that adds a part and then rejects. The engine must remove the
// part and build the empty room.
import * as THREE from 'three';

export default async function interior(ctx) {
  const part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  part.name = 'slow-part';
  ctx.root.add(part);
  await Promise.resolve();
  throw new Error('async interior broken on purpose');
}
