// The valley: a golden sky, green hills, path stones to each door, trees, bushes, flowers, grass,
// rocks, mushrooms and fireflies. The valley is the root pack, so its folder is the site root, and
// it loads the shared nature kit at assets/models/nature/ (design D5, deviation DV-1).
// Child packs must not load the shared kit. They keep their own copies in models/ (risk R2).
import { sky, ground, scatterRing, fireflies } from 'cozy/kit.js';

const KIT = 'assets/models/nature/';

export default function interior(ctx) {
  const { mood, size, layout } = ctx.place;
  const flat = size.walk_limit + 4;
  const R = size.ring;
  const r = ctx.rng;
  sky(ctx.root, mood);
  ground(ctx.root, mood.ground, flat);

  const d = scatterRing(r, layout.doors, flat);
  const each = function (groups, o) {
    for (const m in groups) ctx.model(KIT + m + '.glb', Object.assign({ instances: groups[m] }, o));
  };
  ctx.model(KIT + 'RockPath_Round_Wide.glb', { instances: d.stones() });
  each(
    d.split(
      d.ring(150, R + 9, 110, 3, 7, () => ({ s: 0.9 + r() * 0.6 })),
      ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'Pine_1', 'Pine_2', 'Pine_3', 'TwistedTree_1']
    ),
    { cast: true }
  );
  each(
    d.split(
      d.ring(40, 5, R + 14, 2, 5.5, () => ({ s: 0.5 + r() * 0.4 })),
      ['Bush_Common', 'Bush_Common_Flowers']
    ),
    { cast: true }
  );
  each(
    d.split(
      d.ring(110, 3, R + 16, 1.4, 4.5, () => ({ s: 0.3 + r() * 0.25 })),
      ['Flower_3_Group', 'Flower_4_Group', 'Fern_1', 'Plant_1']
    )
  );
  each(
    d.split(
      d.ring(700, 2, R + 22, 1.1, 4, () => ({ s: 0.25 + r() * 0.3 })),
      ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Tall', 'Clover_1']
    )
  );
  each(
    d.split(
      d.ring(14, 6, R + 20, 2.5, 6, () => ({ s: 0.35 + r() * 0.5 })),
      ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3']
    ),
    { cast: true }
  );
  each(
    d.split(
      d.ring(24, 4, R + 18, 1.5, 4.5, () => ({ s: 1.4 + r() * 0.8 })),
      ['Mushroom_Common']
    )
  );
  fireflies(ctx.root, r);
}
