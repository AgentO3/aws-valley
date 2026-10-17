// The inside of a small house: plank floor, walls, beams, windows, furniture and warm lamps.
import * as THREE from 'three';
import { MAT, plankTexture, rng } from 'cozy/kit.js';

const S = 4.5; // half the room width
const H = 3.2; // room height

export default function interior(ctx) {
  const root = ctx.root;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * S, 2 * S),
    new THREE.MeshStandardMaterial({ map: plankTexture(rng(11)), roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * S, 2 * S),
    new THREE.MeshStandardMaterial({ color: '#d9c19c' })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  root.add(floor, ceil);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#efd9b6', roughness: 0.95 });
  const bandMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.9 });
  [
    [0, -S, 0],
    [0, S, Math.PI],
    [-S, 0, Math.PI / 2],
    [S, 0, -Math.PI / 2]
  ].forEach(function (w) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * S, H), wallMat);
    m.position.set(w[0], H / 2, w[1]);
    m.rotation.y = w[2];
    m.receiveShadow = true;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2 * S, 1), bandMat);
    band.position.set(w[0] * 0.995, 0.5, w[1] * 0.995);
    band.rotation.y = w[2];
    root.add(m, band);
  });
  for (let i = -1; i <= 1; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * S, 0.22, 0.22), MAT.wood);
    beam.position.set(0, H - 0.11, i * 2.6);
    root.add(beam);
  }
  // Two windows with warm evening light.
  const winMat = new THREE.MeshStandardMaterial({ color: '#ffd6a0', emissive: '#ffb873', emissiveIntensity: 1.4 });
  [-2, 2].forEach(function (wx) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.08), MAT.wood);
    frame.position.set(wx, 1.9, -S + 0.04);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), winMat);
    glass.position.set(wx, 1.9, -S + 0.09);
    root.add(frame, glass);
  });
  const k = 0.6;
  const put = function (name, o) {
    ctx.model('models/' + name + '.glb', o);
  };
  put('rug_oval_A', { x: 0, z: -1.6, s: k * 1.3, cast: false });
  put('armchair_pillows', { x: -1.7, z: -2.4, r: 0.6, s: k });
  put('table_small', { x: -0.5, z: -2.9, s: k });
  put('book_set', { x: -0.5, y: 0.62, z: -2.9, s: k });
  put('lamp_standing', { x: -3.6, z: -3.7, s: k });
  put('couch_pillows', { x: 1.9, z: -3.3, r: -0.35, s: k });
  put('shelf_B_large_decorated', { x: -S + 0.35, z: 0.2, r: Math.PI / 2, s: k });
  put('cabinet_small_decorated', { x: S - 0.35, z: 0.6, r: -Math.PI / 2, s: k });
  put('pictureframe_medium', { x: 0, y: 1.7, z: -S + 0.05, s: k });
  const lamp = new THREE.PointLight('#ffad62', 7, 8, 2);
  lamp.position.set(-3.6, 1.9, -3.5);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  const fill = new THREE.PointLight('#ffcf9a', 3, 9, 2);
  fill.position.set(1, 2.7, 0.5);
  root.add(lamp, fill);
  return { sign: { position: '2.2 1.6 -4.4', rotation: '0 0 0' } };
}
