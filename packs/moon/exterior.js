// The portal to the Moon that the parent place shows.
import { portal } from './lib/portal.js';

export default function exterior(ctx) {
  return portal(ctx.root, ctx.place.mood);
}
