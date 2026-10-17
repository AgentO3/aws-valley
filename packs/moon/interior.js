// The Moon: a night sky with stars and a planet, grey ground, rocks and pebbles.
// The exit back to the valley is a portal in the colors of the valley.
import { sky, ground, scatterRing } from 'cozy/kit.js';
import { portal, PORTAL } from './lib/portal.js';

export default function interior(ctx) {
  const { mood, size, layout } = ctx.place;
  const flat = size.walk_limit + 4;
  const r = ctx.rng;
  sky(ctx.root, mood);
  ground(ctx.root, mood.ground, flat);

  const structures = layout.doors.slice();
  if (layout.exit) {
    const e = layout.exit;
    structures.push({
      x: e.x,
      z: e.z,
      door: { x: e.x + Math.sin(e.yaw) * PORTAL.door, z: e.z + Math.cos(e.yaw) * PORTAL.door }
    });
  }
  const d = scatterRing(r, structures, flat);
  const each = function (groups, o) {
    for (const m in groups) ctx.model('models/' + m + '.glb', Object.assign({ instances: groups[m] }, o));
  };
  ctx.model('models/RockPath_Round_Wide.glb', { instances: d.stones() });
  each(
    d.split(
      d.ring(26, 6, 60, 2, 6, () => ({ s: 0.5 + r() * 1.3, sy: 0.6 + r() * 0.5 })),
      ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3']
    ),
    { cast: true }
  );
  each(
    d.split(
      d.ring(120, 3, 45, 1.2, 4, () => ({ s: 1 + r() * 2 })),
      ['Pebble_Round_1', 'Pebble_Round_2']
    )
  );

  return {
    exit: function (exitCtx) {
      return portal(exitCtx.root, exitCtx.place.parent.mood);
    }
  };
}
