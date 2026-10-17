// The inside of the cave: a rock shell, two rows of boulders and clusters of glowing crystals.
import * as THREE from 'three';
import { pick } from 'cozy/kit.js';

export default function interior(ctx) {
  const root = ctx.root;
  const r = ctx.rng;
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(11, 16, 10),
    new THREE.MeshStandardMaterial({ color: '#6b6058', side: THREE.BackSide, flatShading: true, roughness: 1 })
  );
  shell.scale.set(1, 0.5, 1);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(11, 24),
    new THREE.MeshStandardMaterial({ color: '#4a3f37', roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(shell, floor);
  // Two rows of boulders make the cave wall rough and tall.
  const rocks = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * 6.28 + r() * 0.3,
        d = 9.6 - row * 0.8 + r();
      rocks.push({
        x: Math.sin(a) * d,
        y: row * 1.8 - 0.3,
        z: Math.cos(a) * d,
        r: r() * 6.28,
        s: 1 + r() * 0.8,
        sy: 1.2 + r() * 0.6
      });
    }
  }
  ctx.model('models/Rock_Medium_1.glb', { instances: rocks.filter((_, i) => i % 2 === 0) });
  ctx.model('models/Rock_Medium_3.glb', { instances: rocks.filter((_, i) => i % 2 === 1) });
  // Clusters of glowing crystals.
  const colors = ['#4ef0ff', '#b48cff', '#6dffc8'];
  for (let i = 0; i < 9; i++) {
    const a = r() * 6.28,
      d = 4.5 + r() * 3.5,
      c = pick(r, colors);
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.4, flatShading: true });
    const cluster = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.12 + r() * 0.12, 0.6 + r() * 1.1, 5), mat);
      m.position.set((r() - 0.5) * 0.6, 0.3, (r() - 0.5) * 0.6);
      m.rotation.set((r() - 0.5) * 0.8, r() * 6, (r() - 0.5) * 0.8);
      cluster.add(m);
    }
    cluster.position.set(Math.sin(a) * d, 0, Math.cos(a) * d);
    root.add(cluster);
  }
  const p1 = new THREE.PointLight('#5fdcff', 18, 22, 2);
  p1.position.set(0, 3, -3);
  const p2 = new THREE.PointLight('#b08cff', 10, 18, 2);
  p2.position.set(-4, 2, 3);
  const p3 = new THREE.PointLight('#ffb36b', 6, 10, 2);
  p3.position.set(0, 2.4, 7.5);
  root.add(p1, p2, p3);
}
