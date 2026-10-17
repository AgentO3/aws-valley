// A stone ring portal with a swirl in the colors of the mood on the other side. It faces +Z.
import * as THREE from 'three';
import { MAT, lantern, portalDisc, shadows } from 'cozy/kit.js';

export const PORTAL = { door: 0.8, labelHeight: 4.6 };

export function portal(root, mood) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.3, 5, 14), MAT.stone);
  ring.position.y = 2.15;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), portalDisc(mood.horizon, mood.top));
  disc.position.y = 2.15;
  const step = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.3, 7), MAT.stone);
  step.position.y = 0.15;
  root.add(ring, disc, step);
  shadows(ring, true, true);
  shadows(step, false, true);
  lantern(root, -2.4, 0.6);
  lantern(root, 2.4, 0.6);
  return { door: PORTAL.door, labelHeight: PORTAL.labelHeight };
}
