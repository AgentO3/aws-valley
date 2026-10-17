// The house that the parent place shows for this pack. It faces +Z, with its door on the +Z side.
import { lantern } from 'cozy/kit.js';

export default function exterior(ctx) {
  const r = ctx.rng;
  r(); // The old engine picked the house model with this number. Keep it, so the layout stays the same.
  ctx.model('models/building_home_B_red.glb', { s: 6.5 });
  lantern(ctx.root, 1.6, 3.4);
  ctx.model('models/barrel.glb', { instances: [{ x: -2.6, z: 2.6, s: 4.5, r: r() * 6 }] });
  ctx.model('models/crate_A_small.glb', { instances: [{ x: -3.2, z: 1.6, s: 4.5, r: r() * 6 }] });
  return { door: 3.6, labelHeight: 9 };
}
