// The mine entrance that the parent place shows for this pack. It faces +Z, with its door on the +Z side.
import { lantern } from 'cozy/kit.js';

export default function exterior(ctx) {
  ctx.model('models/building_mine_blue.glb', { s: 5 });
  lantern(ctx.root, -2.2, 4.2);
  lantern(ctx.root, 2.2, 4.2);
  return { door: 4.6, labelHeight: 7.4 };
}
