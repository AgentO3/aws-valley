// BDR-012 fixture: an animated entry that throws on each frame. The exit door must still work.
import { animate } from 'cozy/kit.js';

export default function interior() {
  animate({
    tick() {
      throw new Error('animate tick broken on purpose');
    }
  });
}
